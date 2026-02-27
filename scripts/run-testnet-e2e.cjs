#!/usr/bin/env node

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { wallet, rpc, sc, u, tx, experimental } = require("@cityofzion/neon-js");
const { poseidon1Bls, poseidon2Bls, poseidon4Bls } = require("./lib/bls-poseidon.cjs");
const snarkjs = require("snarkjs");
const { getCurveFromName, utils } = require("ffjavascript");
const { unstringifyBigInts } = utils;

const DEFAULT_RPC = process.env.ZNEP17_TESTNET_RPC || "https://n3seed1.ngd.network:20332";
const REQUIRED_NETWORK_MAGIC = 894710606;
const WIF = process.env.ZNEP17_TESTNET_WIF;
const OWNER_WIF = process.env.ZNEP17_TESTNET_OWNER_WIF || "";
const TREE_DEPTH = 20;
const SCALAR_BYTES = 32;
const PROOF_BYTES = 192;
const WITHDRAW_PUBLIC_INPUTS_BYTES = 256;
const TREE_UPDATE_PUBLIC_INPUTS_BYTES = 160;
const WITHDRAW_PUBLIC_INPUT_COUNT = 8;
const TREE_UPDATE_PUBLIC_INPUT_COUNT = 5;
const COMPRESSED_FLAG = 0x80;
const INFINITY_FLAG = 0x40;
const SIGN_FLAG = 0x20;
const CIRCUIT_WASM = path.join(__dirname, "..", "circuits", "bls", "withdraw_js", "withdraw.wasm");
const CIRCUIT_ZKEY = path.join(__dirname, "..", "circuits", "bls", "withdraw_final.zkey");
const TREE_UPDATE_WASM = path.join(__dirname, "..", "circuits", "tree_update_js", "tree_update.wasm");
const TREE_UPDATE_ZKEY = path.join(__dirname, "..", "circuits", "tree_update_final.zkey");

let cachedBlsCurve = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSecureRpcUrl(url) {
  assertCondition(
    /^https:\/\//i.test(url) || /^wss:\/\//i.test(url),
    `ZNEP17_TESTNET_RPC must use https:// or wss://. Received: ${url}`
  );
}

function toBigInt(item) {
  assertCondition(item && item.type === "Integer", `Expected Integer stack item, received: ${JSON.stringify(item)}`);
  return BigInt(item.value);
}

function toBool(item) {
  if (!item) {
    throw new Error("Expected Boolean stack item but value is empty");
  }

  if (item.type === "Boolean") {
    return item.value === true || item.value === "true";
  }

  throw new Error(`Expected Boolean stack item, received: ${JSON.stringify(item)}`);
}

function toBytes(item) {
  if (!item) {
    throw new Error("Expected byte stack item but value is empty");
  }

  if (item.type === "ByteString" || item.type === "Buffer" || item.type === "ByteArray") {
    return Buffer.from(item.value, "base64");
  }

  throw new Error(`Expected byte stack item, received: ${JSON.stringify(item)}`);
}

function fixedHex(value) {
  return Buffer.alloc(32, value & 0xff).toString("hex");
}

function toHex32(value) {
  const hex = value.toString(16);
  assertCondition(hex.length <= 64, `field element overflow (${hex.length} hex chars)`);
  return hex.padStart(64, "0");
}

function buildZeroHashes() {
  const hashes = [0n];
  for (let d = 0; d < TREE_DEPTH; d++) {
    hashes.push(poseidon2Bls([hashes[d], hashes[d]]));
  }
  return hashes;
}

function buildMerkleLayers(leaves, zeroHashes) {
  const layers = [leaves.slice()];
  let current = layers[0];
  for (let d = 0; d < TREE_DEPTH; d++) {
    const nextLength = Math.max(1, Math.ceil(current.length / 2));
    const next = new Array(nextLength);
    for (let i = 0; i < nextLength; i++) {
      const left = current[i * 2] ?? zeroHashes[d];
      const right = current[i * 2 + 1] ?? zeroHashes[d];
      next[i] = poseidon2Bls([left, right]);
    }
    layers.push(next);
    current = next;
  }
  return layers;
}

function computeMerkleProof(leaves, index, zeroHashes) {
  const layers = buildMerkleLayers(leaves, zeroHashes);
  const pathElements = [];
  const pathIndices = [];
  let idx = index;

  for (let d = 0; d < TREE_DEPTH; d++) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = layers[d][siblingIdx] ?? zeroHashes[d];
    pathElements.push(sibling.toString());
    pathIndices.push(idx % 2);
    idx = Math.floor(idx / 2);
  }

  const root = layers[TREE_DEPTH][0] ?? zeroHashes[TREE_DEPTH];
  return { root, pathElements, pathIndices };
}

function encodeLe32(value, label) {
  assertCondition(value >= 0n, `${label} must be non-negative`);
  const out = Buffer.alloc(SCALAR_BYTES);
  let remaining = value;
  for (let i = 0; i < SCALAR_BYTES; i++) {
    out[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  assertCondition(remaining === 0n, `${label} exceeds 32-byte scalar range`);
  return out;
}

function packPublicInputs(publicSignals, expectedCount) {
  assertCondition(
    Array.isArray(publicSignals) && publicSignals.length === expectedCount,
    `expected ${expectedCount} public signals`
  );
  const buffers = publicSignals.map((signal, index) => encodeLe32(BigInt(signal), `publicSignals[${index}]`));
  const packed = Buffer.concat(buffers);
  assertCondition(packed.length === expectedCount * SCALAR_BYTES, "packed public inputs length mismatch");
  return packed;
}

async function getBlsCurve() {
  if (!cachedBlsCurve) {
    cachedBlsCurve = await getCurveFromName("bls12381");
  }
  return cachedBlsCurve;
}

function convertFfCompressedToNeo(bytes) {
  const out = Uint8Array.from(bytes);
  const ffSign = (out[0] & COMPRESSED_FLAG) !== 0;
  const ffInfinity = (out[0] & INFINITY_FLAG) !== 0;
  out[0] &= 0x1f;
  out[0] |= COMPRESSED_FLAG;
  if (ffInfinity) out[0] |= INFINITY_FLAG;
  if (ffSign) out[0] |= SIGN_FLAG;
  return out;
}

async function packGroth16ProofForNeo(proof) {
  const curveName = String(proof?.curve || "").toLowerCase();
  assertCondition(curveName === "bls12381" || curveName === "bls12-381", `unexpected proof curve ${proof?.curve}`);

  const curve = await getBlsCurve();
  const normalizedProof = unstringifyBigInts(proof);
  const pointA = curve.G1.fromObject(normalizedProof.pi_a);
  const pointB = curve.G2.fromObject(normalizedProof.pi_b);
  const pointC = curve.G1.fromObject(normalizedProof.pi_c);
  assertCondition(curve.G1.isValid(pointA), "proof.pi_a is not a valid G1 point");
  assertCondition(curve.G2.isValid(pointB), "proof.pi_b is not a valid G2 point");
  assertCondition(curve.G1.isValid(pointC), "proof.pi_c is not a valid G1 point");

  const a = new Uint8Array(48);
  const b = new Uint8Array(96);
  const c = new Uint8Array(48);

  curve.G1.toRprCompressed(a, 0, pointA);
  curve.G2.toRprCompressed(b, 0, pointB);
  curve.G1.toRprCompressed(c, 0, pointC);

  const packed = Buffer.concat([
    Buffer.from(convertFfCompressedToNeo(a)),
    Buffer.from(convertFfCompressedToNeo(b)),
    Buffer.from(convertFfCompressedToNeo(c)),
  ]);
  assertCondition(packed.length === PROOF_BYTES, "packed proof length mismatch");
  return packed;
}

function buildNote(seed, amountInt, assetScriptHash) {
  const nullifier = BigInt(seed);
  const secret = BigInt(seed + 1000);
  const amount = BigInt(amountInt);
  const assetField = BigInt(`0x${assetScriptHash}`);
  const nullifierHash = poseidon1Bls([nullifier]);
  const commitment = poseidon4Bls([nullifier, secret, amount, assetField]);

  return {
    nullifier,
    secret,
    amount,
    assetField,
    nullifierHash,
    commitment,
    nullifierHex: toHex32(nullifierHash),
    commitmentHex: toHex32(commitment)
  };
}

async function buildWithdrawPayload({
  note,
  leaves,
  leafIndex,
  recipientScriptHash,
  relayerScriptHash,
  fee,
  amountWithdraw
}) {
  const merkle = computeMerkleProof(leaves, leafIndex, buildZeroHashes());
  const rootHex = toHex32(merkle.root);
  
  if (amountWithdraw === undefined) {
    amountWithdraw = note.amount;
  }

  const amountChange = note.amount - amountWithdraw - BigInt(fee);
  
  const newNullifier = BigInt("0x" + require("node:crypto").randomBytes(31).toString("hex"));
  const newSecret = BigInt("0x" + require("node:crypto").randomBytes(31).toString("hex"));
  
  const newNullifierHash = poseidon1Bls([newNullifier]);
  const newCommitment = poseidon4Bls([newNullifier, newSecret, amountChange, note.assetField]);
  
  const newNote = {
    nullifier: newNullifier,
    secret: newSecret,
    amount: amountChange,
    assetField: note.assetField,
    nullifierHash: newNullifierHash,
    commitment: newCommitment,
    nullifierHex: toHex32(newNullifierHash),
    commitmentHex: toHex32(newCommitment)
  };

  const publicSignalsExpected = [
    merkle.root.toString(),
    note.nullifierHash.toString(),
    BigInt(`0x${recipientScriptHash}`).toString(),
    BigInt(`0x${relayerScriptHash}`).toString(),
    BigInt(fee).toString(),
    note.assetField.toString(),
    amountWithdraw.toString(),
    newNote.commitment.toString()
  ];

  const witnessInput = {
    root: merkle.root.toString(),
    nullifierHash: note.nullifierHash.toString(),
    recipient: publicSignalsExpected[2],
    relayer: publicSignalsExpected[3],
    fee: BigInt(fee).toString(),
    asset: note.assetField.toString(),
    amountWithdraw: amountWithdraw.toString(),
    newCommitment: newNote.commitment.toString(),
    nullifier: note.nullifier.toString(),
    secret: note.secret.toString(),
    amountIn: note.amount.toString(),
    newNullifier: newNote.nullifier.toString(),
    newSecret: newNote.secret.toString(),
    amountChange: amountChange.toString(),
    pathElements: merkle.pathElements,
    pathIndices: merkle.pathIndices
  };

  const prove = await snarkjs.groth16.fullProve(witnessInput, CIRCUIT_WASM, CIRCUIT_ZKEY);
  const publicSignals = prove.publicSignals.map((value) => BigInt(value).toString());

  for (let i = 0; i < publicSignalsExpected.length; i++) {
    assertCondition(
      publicSignals[i] === publicSignalsExpected[i],
      `public signal mismatch at index ${i}: expected=${publicSignalsExpected[i]} actual=${publicSignals[i]}`
    );
  }

  const packedProof = await packGroth16ProofForNeo(prove.proof);
  const packedPublicInputs = packPublicInputs(publicSignals, WITHDRAW_PUBLIC_INPUT_COUNT);
  assertCondition(packedPublicInputs.length === WITHDRAW_PUBLIC_INPUTS_BYTES, "withdraw public input payload length mismatch");

  return {
    rootHex,
    nullifierHex: note.nullifierHex,
    commitment: newNote.commitment,
    commitmentHex: newNote.commitmentHex,
    proofHex: packedProof.toString("hex"),
    publicInputsHex: packedPublicInputs.toString("hex")
  };
}

async function buildTreeUpdatePayload({
  leaves,
  leafIndex
}) {
  assertCondition(Number.isSafeInteger(leafIndex) && leafIndex >= 0, "leafIndex must be a non-negative safe integer");
  assertCondition(Array.isArray(leaves), "leaves must be an array");
  assertCondition(leafIndex < leaves.length, `leafIndex ${leafIndex} is out of bounds for ${leaves.length} leaves`);

  const oldLeaves = leaves.slice(0, leafIndex);
  const newLeaf = leaves[leafIndex];
  assertCondition(typeof newLeaf === "bigint", "new leaf must be bigint");

  const zeroHashes = buildZeroHashes();
  const oldLayers = buildMerkleLayers(oldLeaves, zeroHashes);

  const pathElements = [];
  let idx = leafIndex;
  for (let d = 0; d < TREE_DEPTH; d++) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = oldLayers[d][siblingIdx] ?? zeroHashes[d];
    pathElements.push(sibling.toString());
    idx = Math.floor(idx / 2);
  }

  const oldRoot = oldLayers[TREE_DEPTH][0] ?? zeroHashes[TREE_DEPTH];
  const newRoot = computeMerkleProof(leaves, leafIndex, zeroHashes).root;
  const oldLeaf = 0n;
  const leafIndexBig = BigInt(leafIndex);

  const witnessInput = {
    oldRoot: oldRoot.toString(),
    newRoot: newRoot.toString(),
    oldLeaf: oldLeaf.toString(),
    newLeaf: newLeaf.toString(),
    leafIndex: leafIndexBig.toString(),
    pathElements
  };

  const expectedSignals = [
    oldRoot.toString(),
    newRoot.toString(),
    oldLeaf.toString(),
    newLeaf.toString(),
    leafIndexBig.toString()
  ];

  const prove = await snarkjs.groth16.fullProve(witnessInput, TREE_UPDATE_WASM, TREE_UPDATE_ZKEY);
  const publicSignals = prove.publicSignals.map((value) => BigInt(value).toString());
  assertCondition(publicSignals.length === TREE_UPDATE_PUBLIC_INPUT_COUNT, "tree update public signal length mismatch");
  for (let i = 0; i < expectedSignals.length; i++) {
    assertCondition(
      publicSignals[i] === expectedSignals[i],
      `tree update public signal mismatch at index ${i}: expected=${expectedSignals[i]} actual=${publicSignals[i]}`
    );
  }

  const packedProof = await packGroth16ProofForNeo(prove.proof);
  const packedPublicInputs = packPublicInputs(publicSignals, TREE_UPDATE_PUBLIC_INPUT_COUNT);
  assertCondition(
    packedPublicInputs.length === TREE_UPDATE_PUBLIC_INPUTS_BYTES,
    "tree update public input payload length mismatch"
  );

  return {
    oldRootHex: toHex32(oldRoot),
    newRootHex: toHex32(newRoot),
    proofHex: packedProof.toString("hex"),
    publicInputsHex: packedPublicInputs.toString("hex"),
    leafIndex
  };
}

function nowStamp() {
  return new Date().toISOString().replace(/[:]/g, "-").replace(/[.]/g, "_");
}

function toJsonSafeValue(value) {
  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toJsonSafeValue(entry));
  }

  if (value && typeof value === "object") {
    const obj = {};
    for (const [k, v] of Object.entries(value)) {
      obj[k] = toJsonSafeValue(v);
    }
    return obj;
  }

  return value;
}

function stackParamHash160(input) {
  return sc.ContractParam.hash160(input);
}

function stackParamInteger(input) {
  return sc.ContractParam.integer(input.toString());
}

function stackParamByteArrayHex(hex) {
  return sc.ContractParam.byteArray(Buffer.from(hex, "hex").toString("base64"));
}

function getErrorMessage(error) {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return String(error ?? "");
}

function extractExistingContractHash(errorMessage) {
  const match = /contract already exists:\s*0x([0-9a-fA-F]{40})/i.exec(errorMessage);
  return match ? match[1].toLowerCase() : null;
}

async function main() {
  if (!WIF) {
    throw new Error("Missing ZNEP17_TESTNET_WIF environment variable.");
  }
  assertSecureRpcUrl(DEFAULT_RPC);
  assertCondition(fs.existsSync(CIRCUIT_WASM), `Missing circuit wasm: ${CIRCUIT_WASM}`);
  assertCondition(fs.existsSync(CIRCUIT_ZKEY), `Missing circuit zkey: ${CIRCUIT_ZKEY}`);
  assertCondition(fs.existsSync(TREE_UPDATE_WASM), `Missing tree update wasm: ${TREE_UPDATE_WASM}`);
  assertCondition(fs.existsSync(TREE_UPDATE_ZKEY), `Missing tree update zkey: ${TREE_UPDATE_ZKEY}`);

  const report = {
    startedAtUtc: new Date().toISOString(),
    rpc: DEFAULT_RPC,
    networkMagic: null,
    accounts: {},
    contracts: {},
    txs: [],
    assertions: [],
    scenarios: []
  };

  const rpcClient = new rpc.RPCClient(DEFAULT_RPC);
  const version = await rpcClient.getVersion();
  const networkMagic = version.protocol.network;

  assertCondition(
    networkMagic === REQUIRED_NETWORK_MAGIC,
    `Unexpected network magic ${networkMagic}. Expected ${REQUIRED_NETWORK_MAGIC}.`
  );

  report.networkMagic = networkMagic;

  const funder = new wallet.Account(WIF);
  const funderConfig = {
    rpcAddress: DEFAULT_RPC,
    networkMagic,
    account: funder
  };

  report.accounts.funder = {
    address: funder.address,
    scriptHash: funder.scriptHash
  };

  const funderGasContract = new experimental.nep17.GASContract(funderConfig);
  const funderGasBalanceStart = await funderGasContract.balanceOf(funder.address);
  report.assertions.push({
    label: "funder_has_gas",
    expected: "> 120",
    actual: funderGasBalanceStart,
    pass: funderGasBalanceStart > 120
  });
  assertCondition(funderGasBalanceStart > 120, `Funder GAS too low: ${funderGasBalanceStart}`);

  const owner = OWNER_WIF ? new wallet.Account(OWNER_WIF) : new wallet.Account();
  const ownerConfig = {
    rpcAddress: DEFAULT_RPC,
    networkMagic,
    account: owner
  };

  report.accounts.owner = {
    address: owner.address,
    scriptHash: owner.scriptHash
  };

  const ownerSignerGlobal = [
    new tx.Signer({
      account: owner.scriptHash,
      scopes: "Global"
    })
  ];

  async function waitForExecution(txid, label, timeoutMs = 240000) {
    const started = Date.now();
    let lastError = "";

    while (Date.now() - started < timeoutMs) {
      try {
        const appLog = await rpcClient.getApplicationLog(txid);
        if (appLog && Array.isArray(appLog.executions) && appLog.executions.length > 0) {
          return appLog.executions[0];
        }
      } catch (error) {
        lastError = error && error.message ? error.message : String(error);
      }

      await sleep(3000);
    }

    throw new Error(`Timed out waiting for tx ${txid} (${label}). Last error: ${lastError}`);
  }

  async function persistInvokeAndAssert({
    label,
    invoke,
    expectFault = false,
    expectExceptionIncludes = null
  }) {
    console.log(`[tx:start] ${label}`);
    const txid = await invoke();
    const execution = await waitForExecution(txid, label);

    const vmstate = execution.vmstate || "";
    const isFault = vmstate.startsWith("FAULT");

    if (expectFault) {
      assertCondition(isFault, `[${label}] expected FAULT, got ${vmstate}`);
      if (expectExceptionIncludes) {
        report.assertions.push({
          label: `${label}_exception_contains`,
          expected: expectExceptionIncludes,
          actual: execution.exception || "",
          pass: Boolean(execution.exception && execution.exception.includes(expectExceptionIncludes))
        });
      }
    } else {
      assertCondition(!isFault, `[${label}] expected HALT, got ${vmstate} exception='${execution.exception || ""}'`);
    }

    report.txs.push({
      label,
      txid,
      vmstate,
      gasconsumed: execution.gasconsumed,
      exception: execution.exception || null
    });

    console.log(`[tx:end] ${label} ${txid} ${vmstate}`);

    return { txid, execution };
  }

  if (owner.address !== funder.address) {
    await persistInvokeAndAssert({
      label: "fund_owner_gas",
      invoke: () => funderGasContract.transfer(funder.address, owner.address, 120),
      expectFault: false
    });
  } else {
    report.assertions.push({
      label: "owner_is_funder",
      expected: false,
      actual: true,
      pass: true
    });
  }

  const gasContract = new experimental.nep17.GASContract(ownerConfig);
  const ownerGasBalanceStart = await gasContract.balanceOf(owner.address);
  report.assertions.push({
    label: "owner_has_gas",
    expected: "> 80",
    actual: ownerGasBalanceStart,
    pass: ownerGasBalanceStart > 80
  });
  assertCondition(ownerGasBalanceStart > 80, `Owner GAS too low after funding: ${ownerGasBalanceStart}`);

  async function readInvoke(contractHash, operation, args = []) {
    const response = await rpcClient.invokeFunction(contractHash, operation, args);
    assertCondition(response.state === "HALT", `Read invoke failed for ${operation} on ${contractHash}. ${response.exception || ""}`);
    return response.stack;
  }

  async function readBalance(tokenHash, address) {
    const stack = await readInvoke(tokenHash, "balanceOf", [stackParamHash160(address)]);
    return toBigInt(stack[0]);
  }

  async function readEscrow(vaultHash, tokenHash) {
    const stack = await readInvoke(vaultHash, "getAssetEscrowBalance", [stackParamHash160(tokenHash)]);
    return toBigInt(stack[0]);
  }

  async function readCurrentRootHex(vaultHash) {
    const stack = await readInvoke(vaultHash, "getCurrentRoot");
    return toBytes(stack[0]).toString("hex");
  }

  async function updateRootAndAssert({
    contract,
    vaultHash,
    leaves,
    leafIndex,
    label,
    signer
  }) {
    const treeUpdate = await buildTreeUpdatePayload({
      leaves,
      leafIndex
    });

    await persistInvokeAndAssert({
      label,
      invoke: () =>
        contract.invoke(
          "updateMerkleRoot",
          [
            stackParamByteArrayHex(treeUpdate.proofHex),
            stackParamByteArrayHex(treeUpdate.publicInputsHex),
            stackParamByteArrayHex(treeUpdate.newRootHex)
          ],
          signer
        ),
      expectFault: false
    });

    const root = await readCurrentRootHex(vaultHash);
    assertCondition(root === treeUpdate.newRootHex, `${label} root mismatch expected ${treeUpdate.newRootHex}, got ${root}`);
    return root;
  }

  async function readNullifierUsed(vaultHash, nullifierHex) {
    const stack = await readInvoke(vaultHash, "isNullifierUsed", [stackParamByteArrayHex(nullifierHex)]);
    return toBool(stack[0]);
  }

  async function readVerifierResult(
    verifierContractHash,
    {
      assetHash,
      proofHex,
      publicInputsHex,
      rootHex,
      nullifierHex,
      commitmentHex,
      recipientHash,
      relayerHash,
      amount,
      fee
    }
  ) {
    const stack = await readInvoke(verifierContractHash, "verify", [
      stackParamHash160(assetHash),
      stackParamByteArrayHex(proofHex),
      stackParamByteArrayHex(publicInputsHex),
      stackParamByteArrayHex(rootHex),
      stackParamByteArrayHex(nullifierHex),
      stackParamByteArrayHex(commitmentHex),
      stackParamHash160(recipientHash),
      stackParamHash160(relayerHash),
      stackParamInteger(amount),
      stackParamInteger(fee)
    ]);
    return toBool(stack[0]);
  }

  async function deployFromArtifacts(contractFileName, deployConfig, deployLabel) {
    const artifactsDir = path.join(__dirname, "..", "tests", "zNEP17.Protocol.Tests", "TestingArtifacts");
    const nefPath = path.join(artifactsDir, `${contractFileName}.nef`);
    const manifestPath = path.join(artifactsDir, `${contractFileName}.manifest.json`);

    const nef = sc.NEF.fromBuffer(fs.readFileSync(nefPath));
    const manifest = sc.ContractManifest.fromJson(JSON.parse(fs.readFileSync(manifestPath, "utf8")));

    let deployResult;
    try {
      deployResult = await persistInvokeAndAssert({
        label: `${deployLabel}_deploy`,
        invoke: () => experimental.deployContract(nef, manifest, deployConfig),
        expectFault: false
      });
    } catch (error) {
      const messageRaw = getErrorMessage(error);
      const message = messageRaw.toLowerCase();
      if (message.includes("system.storage.local.put failed: syscall not found")) {
        throw new Error(
          `${deployLabel} deploy failed on RPC ${DEFAULT_RPC}: endpoint does not support System.Storage.Local deploy simulation. ` +
          `Use ZNEP17_TESTNET_RPC=https://n3seed1.ngd.network:20332 for this contract build.`
        );
      }

      const existingHash = extractExistingContractHash(messageRaw);
      if (!existingHash) {
        throw error;
      }

      throw new Error(
        `${deployLabel} deployment collision: contract 0x${existingHash} already exists for this deployer and artifact. ` +
        `This e2e workflow requires fresh contract state. ` +
        `Run without ZNEP17_TESTNET_OWNER_WIF (random ephemeral owner), or use a different owner WIF.`
      );
    }

    const deployNotification = (deployResult.execution.notifications || []).find(
      (notification) => notification.eventname === "Deploy"
    );

    assertCondition(deployNotification, `No Deploy notification found for ${deployLabel}`);
    assertCondition(deployNotification.state && deployNotification.state.type === "Array", `Unexpected Deploy notification state for ${deployLabel}`);
    assertCondition(
      Array.isArray(deployNotification.state.value) &&
        deployNotification.state.value.length > 0 &&
        deployNotification.state.value[0].type === "ByteString",
      `Unexpected Deploy notification payload for ${deployLabel}`
    );

    const deployedHashLittleEndian = Buffer.from(deployNotification.state.value[0].value, "base64");
    const contractHash = Buffer.from(deployedHashLittleEndian).reverse().toString("hex");
    const deployed = await rpcClient.getContractState(contractHash);
    assertCondition(deployed.manifest.name === manifest.name, `Unexpected deployed manifest for ${deployLabel}`);

    report.contracts[deployLabel] = {
      hash: contractHash,
      name: manifest.name,
      checksum: nef.checksum,
      reused: false
    };

    return contractHash;
  }

  // Deploy main contracts.
  const tokenHash = await deployFromArtifacts("TestNep17Token", ownerConfig, "token");
  const verifierHash = await deployFromArtifacts("zNEP17Groth16Verifier", ownerConfig, "verifier");
  const vaultHash = await deployFromArtifacts("zNEP17Protocol", ownerConfig, "vaultMain");

  const verifierState = await rpcClient.getContractState(verifierHash);
  const verifierMethods = (verifierState?.manifest?.abi?.methods || []).map((m) => m.name);
  const verifierPublicMethods = verifierMethods.filter((name) => !name.startsWith("_"));
  const verifierManifestStrong =
    verifierPublicMethods.length === 2 &&
    verifierPublicMethods.includes("verify") &&
    verifierPublicMethods.includes("verifyTreeUpdate");
  report.assertions.push({
    label: "verifier_manifest_public_method_surface",
    expected: "verify,verifyTreeUpdate",
    actual: verifierPublicMethods.join(","),
    pass: verifierManifestStrong
  });
  assertCondition(
    verifierManifestStrong,
    `Verifier manifest method surface mismatch. Expected [verify, verifyTreeUpdate], got [${verifierPublicMethods.join(",")}]`
  );

  const tokenContract = new experimental.SmartContract(tokenHash, ownerConfig);
  const vaultContract = new experimental.SmartContract(vaultHash, ownerConfig);
  const ownerFaultConfig = {
    ...ownerConfig,
    systemFeeOverride: u.BigInteger.fromDecimal(5, 8)
  };
  const vaultContractFault = new experimental.SmartContract(vaultHash, ownerFaultConfig);

  // Configure verifier and mint test funds.
  await persistInvokeAndAssert({
    label: "vault_set_verifier_main",
    invoke: () => vaultContract.invoke("setVerifier", [stackParamHash160(verifierHash)], ownerSignerGlobal),
    expectFault: false
  });

  await persistInvokeAndAssert({
    label: "vault_set_relayer_main",
    invoke: () => vaultContract.invoke("setRelayer", [stackParamHash160(owner.address)], ownerSignerGlobal),
    expectFault: false
  });

  await persistInvokeAndAssert({
    label: "vault_allow_asset_main",
    invoke: () => vaultContract.invoke("setAssetAllowed", [stackParamHash160(tokenHash), sc.ContractParam.boolean(true)], ownerSignerGlobal),
    expectFault: false
  });

  await persistInvokeAndAssert({
    label: "token_mint_owner_initial",
    invoke: () => tokenContract.invoke(
      "mintForTesting",
      [stackParamHash160(owner.address), stackParamInteger(200)],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  const mainLeaves = [];

  const recipientA = new wallet.Account();
  const stealthA = new wallet.Account();
  const noteA = buildNote(0x5101, 10n, tokenHash);
  const leafA = noteA.commitmentHex;

  await persistInvokeAndAssert({
    label: "vault_deposit_s1",
    invoke: () => tokenContract.invoke(
      "transfer",
      [
        stackParamHash160(owner.address),
        stackParamHash160(vaultHash),
        stackParamInteger(10),
        sc.ContractParam.array(
          stackParamHash160(stealthA.address),
          stackParamByteArrayHex(leafA)
        )
      ],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  mainLeaves.push(noteA.commitment);
  const payloadA = await buildWithdrawPayload({
    note: noteA,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    recipientScriptHash: recipientA.scriptHash,
    relayerScriptHash: owner.scriptHash,
    fee: 2n
  });
  const rootA = await updateRootAndAssert({
    contract: vaultContract,
    vaultHash,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    label: "vault_update_root_s1",
    signer: ownerSignerGlobal
  });
  const nullifierA = payloadA.nullifierHex;

  const verifierDirectValid = await readVerifierResult(verifierHash, {
    assetHash: tokenHash,
    proofHex: payloadA.proofHex,
    publicInputsHex: payloadA.publicInputsHex,
    rootHex: rootA,
    nullifierHex: nullifierA,
    commitmentHex: payloadA.commitmentHex,
    recipientHash: recipientA.scriptHash,
    relayerHash: owner.scriptHash,
    amount: 10n,
    fee: 2n
  });
  assertCondition(verifierDirectValid === true, "Direct verifier call rejected a known-valid proof");
  report.assertions.push({
    label: "verifier_direct_accepts_valid_proof",
    expected: true,
    actual: verifierDirectValid,
    pass: verifierDirectValid === true
  });

  const tamperedVerifierPublicInputs = Buffer.from(payloadA.publicInputsHex, "hex");
  tamperedVerifierPublicInputs[0] ^= 0x01;
  const verifierDirectTampered = await readVerifierResult(verifierHash, {
    assetHash: tokenHash,
    proofHex: payloadA.proofHex,
    publicInputsHex: tamperedVerifierPublicInputs.toString("hex"),
    rootHex: rootA,
    nullifierHex: nullifierA,
    commitmentHex: payloadA.commitmentHex,
    recipientHash: recipientA.scriptHash,
    relayerHash: owner.scriptHash,
    amount: 10n,
    fee: 2n
  });
  assertCondition(verifierDirectTampered === false, "Direct verifier call accepted tampered public inputs");
  report.assertions.push({
    label: "verifier_direct_rejects_tampered_public_inputs",
    expected: false,
    actual: verifierDirectTampered,
    pass: verifierDirectTampered === false
  });
  report.scenarios.push({ name: "verifier_direct_onchain_validation", pass: true });

  await persistInvokeAndAssert({
    label: "vault_withdraw_success_s1",
    invoke: () => vaultContract.invoke(
      "withdraw",
      [
        stackParamHash160(tokenHash),
        stackParamByteArrayHex(payloadA.proofHex),
        stackParamByteArrayHex(payloadA.publicInputsHex),
        stackParamByteArrayHex(rootA),
        stackParamByteArrayHex(nullifierA),
        stackParamByteArrayHex(payloadA.commitmentHex),
        stackParamHash160(recipientA.address),
        stackParamHash160(owner.address),
        stackParamInteger(10),
        stackParamInteger(2)
      ],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  const vaultBalanceAfterS1 = await readBalance(tokenHash, vaultHash);
  const recipientABalance = await readBalance(tokenHash, recipientA.address);
  const relayerABalance = await readBalance(tokenHash, owner.address);
  const nullifierAUsed = await readNullifierUsed(vaultHash, nullifierA);

  assertCondition(vaultBalanceAfterS1 === 0n, `Scenario 1 vault balance expected 0, got ${vaultBalanceAfterS1}`);
  assertCondition(recipientABalance === 8n, `Scenario 1 recipient expected 8, got ${recipientABalance}`);
  assertCondition(relayerABalance === 192n, `Scenario 1 relayer expected 192, got ${relayerABalance}`);
  assertCondition(nullifierAUsed === true, "Scenario 1 nullifier should be used");

  report.scenarios.push({ name: "success_path", pass: true });

  mainLeaves.push(payloadA.commitment);
  await updateRootAndAssert({
    contract: vaultContract,
    vaultHash,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    label: "vault_update_root_change_s1",
    signer: ownerSignerGlobal
  });

  // Scenario 2: invalid proof is rejected and state remains unchanged.
  const recipientB = new wallet.Account();
  const stealthB = new wallet.Account();
  const noteB = buildNote(0x6201, 10n, tokenHash);
  const leafB = noteB.commitmentHex;
  const nullifierB = noteB.nullifierHex;

  await persistInvokeAndAssert({
    label: "vault_deposit_s2",
    invoke: () => tokenContract.invoke(
      "transfer",
      [
        stackParamHash160(owner.address),
        stackParamHash160(vaultHash),
        stackParamInteger(10),
        sc.ContractParam.array(
          stackParamHash160(stealthB.address),
          stackParamByteArrayHex(leafB)
        )
      ],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  mainLeaves.push(noteB.commitment);
  const payloadB = await buildWithdrawPayload({
    note: noteB,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    recipientScriptHash: recipientB.scriptHash,
    relayerScriptHash: owner.scriptHash,
    fee: 1n
  });
  const rootB = await updateRootAndAssert({
    contract: vaultContract,
    vaultHash,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    label: "vault_update_root_s2",
    signer: ownerSignerGlobal
  });
  const vaultBalanceBeforeFailS2 = await readBalance(tokenHash, vaultHash);
  const tamperedPublicInputsB = Buffer.from(payloadB.publicInputsHex, "hex");
  tamperedPublicInputsB[0] ^= 0x01;

  await persistInvokeAndAssert({
    label: "vault_withdraw_invalid_proof_s2",
    invoke: () => vaultContractFault.invoke(
      "withdraw",
      [
        stackParamHash160(tokenHash),
        stackParamByteArrayHex(payloadB.proofHex),
        stackParamByteArrayHex(tamperedPublicInputsB.toString("hex")),
        stackParamByteArrayHex(rootB),
        stackParamByteArrayHex(nullifierB),
        stackParamByteArrayHex(payloadB.commitmentHex),
        stackParamHash160(recipientB.address),
        stackParamHash160(owner.address),
        stackParamInteger(10),
        stackParamInteger(1)
      ],
      ownerSignerGlobal
    ),
    expectFault: true,
    expectExceptionIncludes: "zk proof invalid"
  });

  const vaultBalanceAfterFailS2 = await readBalance(tokenHash, vaultHash);
  const nullifierBUsedAfterFail = await readNullifierUsed(vaultHash, nullifierB);

  assertCondition(vaultBalanceBeforeFailS2 === vaultBalanceAfterFailS2, "Scenario 2 vault balance changed after failed withdraw");
  assertCondition(nullifierBUsedAfterFail === false, "Scenario 2 nullifier should remain unused after failed withdraw");

  await persistInvokeAndAssert({
    label: "vault_withdraw_cleanup_s2",
    invoke: () => vaultContract.invoke(
      "withdraw",
      [
        stackParamHash160(tokenHash),
        stackParamByteArrayHex(payloadB.proofHex),
        stackParamByteArrayHex(payloadB.publicInputsHex),
        stackParamByteArrayHex(rootB),
        stackParamByteArrayHex(nullifierB),
        stackParamByteArrayHex(payloadB.commitmentHex),
        stackParamHash160(recipientB.address),
        stackParamHash160(owner.address),
        stackParamInteger(10),
        stackParamInteger(1)
      ],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  mainLeaves.push(payloadB.commitment);
  await updateRootAndAssert({
    contract: vaultContract,
    vaultHash,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    label: "vault_update_root_change_s2",
    signer: ownerSignerGlobal
  });

  report.scenarios.push({ name: "invalid_proof_rejected_keeps_state", pass: true });

  // Scenario 3: unknown root rejected.
  const recipientC = new wallet.Account();
  const stealthC = new wallet.Account();
  const noteC = buildNote(0x7301, 10n, tokenHash);
  const leafC = noteC.commitmentHex;
  const nullifierC = noteC.nullifierHex;
  const unknownRoot = fixedHex(0x72);

  await persistInvokeAndAssert({
    label: "vault_deposit_s3",
    invoke: () => tokenContract.invoke(
      "transfer",
      [
        stackParamHash160(owner.address),
        stackParamHash160(vaultHash),
        stackParamInteger(10),
        sc.ContractParam.array(
          stackParamHash160(stealthC.address),
          stackParamByteArrayHex(leafC)
        )
      ],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  mainLeaves.push(noteC.commitment);
  const payloadC = await buildWithdrawPayload({
    note: noteC,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    recipientScriptHash: recipientC.scriptHash,
    relayerScriptHash: owner.scriptHash,
    fee: 1n
  });
  const rootC = await updateRootAndAssert({
    contract: vaultContract,
    vaultHash,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    label: "vault_update_root_s3",
    signer: ownerSignerGlobal
  });
  assertCondition(rootC !== unknownRoot, "Scenario 3 unknown root accidentally matched current root");
  const vaultBalanceBeforeFailS3 = await readBalance(tokenHash, vaultHash);

  await persistInvokeAndAssert({
    label: "vault_withdraw_unknown_root_s3",
    invoke: () => vaultContractFault.invoke(
      "withdraw",
      [
        stackParamHash160(tokenHash),
        stackParamByteArrayHex(payloadC.proofHex),
        stackParamByteArrayHex(payloadC.publicInputsHex),
        stackParamByteArrayHex(unknownRoot),
        stackParamByteArrayHex(nullifierC),
        stackParamByteArrayHex(payloadC.commitmentHex),
        stackParamHash160(recipientC.address),
        stackParamHash160(owner.address),
        stackParamInteger(10),
        stackParamInteger(1)
      ],
      ownerSignerGlobal
    ),
    expectFault: true,
    expectExceptionIncludes: "unknown merkle root"
  });

  const vaultBalanceAfterFailS3 = await readBalance(tokenHash, vaultHash);
  const nullifierCUsedAfterFail = await readNullifierUsed(vaultHash, nullifierC);

  assertCondition(vaultBalanceBeforeFailS3 === vaultBalanceAfterFailS3, "Scenario 3 vault balance changed after unknown-root failure");
  assertCondition(nullifierCUsedAfterFail === false, "Scenario 3 nullifier should remain unused");

  await persistInvokeAndAssert({
    label: "vault_withdraw_cleanup_s3",
    invoke: () => vaultContract.invoke(
      "withdraw",
      [
        stackParamHash160(tokenHash),
        stackParamByteArrayHex(payloadC.proofHex),
        stackParamByteArrayHex(payloadC.publicInputsHex),
        stackParamByteArrayHex(rootC),
        stackParamByteArrayHex(nullifierC),
        stackParamByteArrayHex(payloadC.commitmentHex),
        stackParamHash160(recipientC.address),
        stackParamHash160(owner.address),
        stackParamInteger(10),
        stackParamInteger(1)
      ],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  mainLeaves.push(payloadC.commitment);
  await updateRootAndAssert({
    contract: vaultContract,
    vaultHash,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    label: "vault_update_root_change_s3",
    signer: ownerSignerGlobal
  });

  report.scenarios.push({ name: "unknown_root_rejected", pass: true });

  // Scenario 4: fee >= amount rejected.
  const recipientD = new wallet.Account();
  const stealthD = new wallet.Account();
  const noteD = buildNote(0x8201, 10n, tokenHash);
  const leafD = noteD.commitmentHex;
  const nullifierD = noteD.nullifierHex;

  await persistInvokeAndAssert({
    label: "vault_deposit_s4",
    invoke: () => tokenContract.invoke(
      "transfer",
      [
        stackParamHash160(owner.address),
        stackParamHash160(vaultHash),
        stackParamInteger(10),
        sc.ContractParam.array(
          stackParamHash160(stealthD.address),
          stackParamByteArrayHex(leafD)
        )
      ],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  mainLeaves.push(noteD.commitment);
  const payloadD = await buildWithdrawPayload({
    note: noteD,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    recipientScriptHash: recipientD.scriptHash,
    relayerScriptHash: owner.scriptHash,
    fee: 1n
  });
  const rootD = await updateRootAndAssert({
    contract: vaultContract,
    vaultHash,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    label: "vault_update_root_s4",
    signer: ownerSignerGlobal
  });
  const vaultBalanceBeforeFailS4 = await readBalance(tokenHash, vaultHash);

  await persistInvokeAndAssert({
    label: "vault_withdraw_fee_ge_amount_s4",
    invoke: () => vaultContractFault.invoke(
      "withdraw",
      [
        stackParamHash160(tokenHash),
        stackParamByteArrayHex(payloadD.proofHex),
        stackParamByteArrayHex(payloadD.publicInputsHex),
        stackParamByteArrayHex(rootD),
        stackParamByteArrayHex(nullifierD),
        stackParamByteArrayHex(payloadD.commitmentHex),
        stackParamHash160(recipientD.address),
        stackParamHash160(owner.address),
        stackParamInteger(10),
        stackParamInteger(10)
      ],
      ownerSignerGlobal
    ),
    expectFault: true,
    expectExceptionIncludes: "invalid withdraw arguments"
  });

  const vaultBalanceAfterFailS4 = await readBalance(tokenHash, vaultHash);
  const nullifierDUsedAfterFail = await readNullifierUsed(vaultHash, nullifierD);

  assertCondition(vaultBalanceBeforeFailS4 === vaultBalanceAfterFailS4, "Scenario 4 vault balance changed after fee failure");
  assertCondition(nullifierDUsedAfterFail === false, "Scenario 4 nullifier should remain unused");

  await persistInvokeAndAssert({
    label: "vault_withdraw_cleanup_s4",
    invoke: () => vaultContract.invoke(
      "withdraw",
      [
        stackParamHash160(tokenHash),
        stackParamByteArrayHex(payloadD.proofHex),
        stackParamByteArrayHex(payloadD.publicInputsHex),
        stackParamByteArrayHex(rootD),
        stackParamByteArrayHex(nullifierD),
        stackParamByteArrayHex(payloadD.commitmentHex),
        stackParamHash160(recipientD.address),
        stackParamHash160(owner.address),
        stackParamInteger(10),
        stackParamInteger(1)
      ],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  mainLeaves.push(payloadD.commitment);
  await updateRootAndAssert({
    contract: vaultContract,
    vaultHash,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    label: "vault_update_root_change_s4",
    signer: ownerSignerGlobal
  });

  report.scenarios.push({ name: "fee_ge_amount_rejected", pass: true });

  // Scenario 4b: commitment amount binding enforced.
  const recipientG = new wallet.Account();
  const stealthG = new wallet.Account();
  const noteG = buildNote(0x8901, 10n, tokenHash);
  const leafG = noteG.commitmentHex;
  const nullifierG = noteG.nullifierHex;

  await persistInvokeAndAssert({
    label: "vault_deposit_s4b",
    invoke: () => tokenContract.invoke(
      "transfer",
      [
        stackParamHash160(owner.address),
        stackParamHash160(vaultHash),
        stackParamInteger(10),
        sc.ContractParam.array(
          stackParamHash160(stealthG.address),
          stackParamByteArrayHex(leafG)
        )
      ],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  mainLeaves.push(noteG.commitment);
  const payloadG = await buildWithdrawPayload({
    note: noteG,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    recipientScriptHash: recipientG.scriptHash,
    relayerScriptHash: owner.scriptHash,
    fee: 1n
  });
  const rootG = await updateRootAndAssert({
    contract: vaultContract,
    vaultHash,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    label: "vault_update_root_s4b",
    signer: ownerSignerGlobal
  });
  const vaultBalanceBeforeFailS4b = await readBalance(tokenHash, vaultHash);

  await persistInvokeAndAssert({
    label: "vault_withdraw_amount_binding_s4b",
    invoke: () => vaultContractFault.invoke(
      "withdraw",
      [
        stackParamHash160(tokenHash),
        stackParamByteArrayHex(payloadG.proofHex),
        stackParamByteArrayHex(payloadG.publicInputsHex),
        stackParamByteArrayHex(rootG),
        stackParamByteArrayHex(nullifierG),
        stackParamByteArrayHex(payloadG.commitmentHex),
        stackParamHash160(recipientG.address),
        stackParamHash160(owner.address),
        stackParamInteger(9),
        stackParamInteger(1)
      ],
      ownerSignerGlobal
    ),
    expectFault: true,
    expectExceptionIncludes: "commitment amount mismatch"
  });

  const vaultBalanceAfterFailS4b = await readBalance(tokenHash, vaultHash);
  const nullifierGUsedAfterFail = await readNullifierUsed(vaultHash, nullifierG);

  assertCondition(vaultBalanceBeforeFailS4b === vaultBalanceAfterFailS4b, "Scenario 4b vault balance changed after amount-binding failure");
  assertCondition(nullifierGUsedAfterFail === false, "Scenario 4b nullifier should remain unused");

  await persistInvokeAndAssert({
    label: "vault_withdraw_cleanup_s4b",
    invoke: () => vaultContract.invoke(
      "withdraw",
      [
        stackParamHash160(tokenHash),
        stackParamByteArrayHex(payloadG.proofHex),
        stackParamByteArrayHex(payloadG.publicInputsHex),
        stackParamByteArrayHex(rootG),
        stackParamByteArrayHex(nullifierG),
        stackParamByteArrayHex(payloadG.commitmentHex),
        stackParamHash160(recipientG.address),
        stackParamHash160(owner.address),
        stackParamInteger(10),
        stackParamInteger(1)
      ],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  mainLeaves.push(payloadG.commitment);
  await updateRootAndAssert({
    contract: vaultContract,
    vaultHash,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    label: "vault_update_root_change_s4b",
    signer: ownerSignerGlobal
  });

  report.scenarios.push({ name: "commitment_amount_binding_enforced", pass: true });

  // Scenario 5: nullifier replay rejected.
  const recipientF = new wallet.Account();
  const stealthF = new wallet.Account();
  const noteF = buildNote(0xa201, 10n, tokenHash);
  const leafF = noteF.commitmentHex;
  const nullifierF = noteF.nullifierHex;

  await persistInvokeAndAssert({
    label: "vault_deposit_s5",
    invoke: () => tokenContract.invoke(
      "transfer",
      [
        stackParamHash160(owner.address),
        stackParamHash160(vaultHash),
        stackParamInteger(10),
        sc.ContractParam.array(
          stackParamHash160(stealthF.address),
          stackParamByteArrayHex(leafF)
        )
      ],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  mainLeaves.push(noteF.commitment);
  const payloadF = await buildWithdrawPayload({
    note: noteF,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    recipientScriptHash: recipientF.scriptHash,
    relayerScriptHash: owner.scriptHash,
    fee: 1n
  });
  const rootF = await updateRootAndAssert({
    contract: vaultContract,
    vaultHash,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    label: "vault_update_root_s5",
    signer: ownerSignerGlobal
  });

  await persistInvokeAndAssert({
    label: "vault_withdraw_first_s5",
    invoke: () => vaultContract.invoke(
      "withdraw",
      [
        stackParamHash160(tokenHash),
        stackParamByteArrayHex(payloadF.proofHex),
        stackParamByteArrayHex(payloadF.publicInputsHex),
        stackParamByteArrayHex(rootF),
        stackParamByteArrayHex(nullifierF),
        stackParamByteArrayHex(payloadF.commitmentHex),
        stackParamHash160(recipientF.address),
        stackParamHash160(owner.address),
        stackParamInteger(10),
        stackParamInteger(1)
      ],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  const vaultBalanceBeforeReplayS5 = await readBalance(tokenHash, vaultHash);

  await persistInvokeAndAssert({
    label: "vault_withdraw_replay_s5",
    invoke: () => vaultContractFault.invoke(
      "withdraw",
      [
        stackParamHash160(tokenHash),
        stackParamByteArrayHex(payloadF.proofHex),
        stackParamByteArrayHex(payloadF.publicInputsHex),
        stackParamByteArrayHex(rootF),
        stackParamByteArrayHex(nullifierF),
        stackParamByteArrayHex(payloadF.commitmentHex),
        stackParamHash160(recipientF.address),
        stackParamHash160(owner.address),
        stackParamInteger(10),
        stackParamInteger(1)
      ],
      ownerSignerGlobal
    ),
    expectFault: true,
    expectExceptionIncludes: "nullifier already used"
  });

  const vaultBalanceAfterReplayS5 = await readBalance(tokenHash, vaultHash);
  const nullifierFUsed = await readNullifierUsed(vaultHash, nullifierF);

  assertCondition(vaultBalanceBeforeReplayS5 === vaultBalanceAfterReplayS5, "Scenario 5 vault balance changed after replay rejection");
  assertCondition(nullifierFUsed === true, "Scenario 5 nullifier should remain marked used");

  mainLeaves.push(payloadF.commitment);
  await updateRootAndAssert({
    contract: vaultContract,
    vaultHash,
    leaves: mainLeaves,
    leafIndex: mainLeaves.length - 1,
    label: "vault_update_root_change_s5",
    signer: ownerSignerGlobal
  });

  report.scenarios.push({ name: "nullifier_replay_rejected", pass: true });

  // Scenario 6: verifier unset rejection on a second vault from a different deployer.
  const altOwner = new wallet.Account();
  report.accounts.altOwner = {
    address: altOwner.address,
    scriptHash: altOwner.scriptHash
  };

  const altOwnerConfig = {
    rpcAddress: DEFAULT_RPC,
    networkMagic,
    account: altOwner
  };
  const altOwnerFaultConfig = {
    ...altOwnerConfig,
    systemFeeOverride: u.BigInteger.fromDecimal(5, 8)
  };

  const altOwnerSignerGlobal = [
    new tx.Signer({
      account: altOwner.scriptHash,
      scopes: "Global"
    })
  ];

  await persistInvokeAndAssert({
    label: "fund_alt_owner_gas_s6",
    invoke: () => gasContract.transfer(owner.address, altOwner.address, 30),
    expectFault: false
  });

  const altOwnerGas = await new experimental.nep17.GASContract(altOwnerConfig).balanceOf(altOwner.address);
  assertCondition(altOwnerGas > 1, `Scenario 6 alt owner GAS too low: ${altOwnerGas}`);

  const vaultNoVerifierHash = await deployFromArtifacts("zNEP17Protocol", altOwnerConfig, "vaultNoVerifier");
  const vaultNoVerifierContract = new experimental.SmartContract(vaultNoVerifierHash, altOwnerConfig);
  const vaultNoVerifierContractFault = new experimental.SmartContract(vaultNoVerifierHash, altOwnerFaultConfig);

  await persistInvokeAndAssert({
    label: "vault_no_verifier_set_relayer_s6",
    invoke: () => vaultNoVerifierContract.invoke("setRelayer", [stackParamHash160(altOwner.address)], altOwnerSignerGlobal),
    expectFault: false
  });

  await persistInvokeAndAssert({
    label: "vault_no_verifier_allow_asset_s6",
    invoke: () =>
      vaultNoVerifierContract.invoke(
        "setAssetAllowed",
        [stackParamHash160(tokenHash), sc.ContractParam.boolean(true)],
        altOwnerSignerGlobal
      ),
    expectFault: false
  });

  await persistInvokeAndAssert({
    label: "token_mint_alt_owner_s6",
    invoke: () => tokenContract.invoke(
      "mintForTesting",
      [stackParamHash160(altOwner.address), stackParamInteger(20)],
      ownerSignerGlobal
    ),
    expectFault: false
  });

  const stealthE = new wallet.Account();
  const noVerifierLeaves = [];
  const noteE = buildNote(0x9201, 10n, tokenHash);
  const leafE = noteE.commitmentHex;
  const nullifierE = noteE.nullifierHex;

  await persistInvokeAndAssert({
    label: "vault_no_verifier_deposit_s6",
    invoke: () => new experimental.SmartContract(tokenHash, altOwnerConfig).invoke(
      "transfer",
      [
        stackParamHash160(altOwner.address),
        stackParamHash160(vaultNoVerifierHash),
        stackParamInteger(10),
        sc.ContractParam.array(
          stackParamHash160(stealthE.address),
          stackParamByteArrayHex(leafE)
        )
      ],
      altOwnerSignerGlobal
    ),
    expectFault: false
  });

  noVerifierLeaves.push(noteE.commitment);
  const treeUpdateE = await buildTreeUpdatePayload({
    leaves: noVerifierLeaves,
    leafIndex: noVerifierLeaves.length - 1
  });

  const vaultNoVerifierBalanceBeforeFail = await readBalance(tokenHash, vaultNoVerifierHash);
  await persistInvokeAndAssert({
    label: "vault_no_verifier_update_root_s6",
    invoke: () => vaultNoVerifierContractFault.invoke(
      "updateMerkleRoot",
      [
        stackParamByteArrayHex(treeUpdateE.proofHex),
        stackParamByteArrayHex(treeUpdateE.publicInputsHex),
        stackParamByteArrayHex(treeUpdateE.newRootHex)
      ],
      altOwnerSignerGlobal
    ),
    expectFault: true,
    expectExceptionIncludes: "verifier not configured"
  });

  const rootE = await readCurrentRootHex(vaultNoVerifierHash);
  assertCondition(rootE.length === 0, `Scenario 6 root should remain unset when verifier is missing. got=${rootE}`);

  const vaultNoVerifierBalanceAfterFail = await readBalance(tokenHash, vaultNoVerifierHash);
  const nullifierEUsed = await readNullifierUsed(vaultNoVerifierHash, nullifierE);

  assertCondition(
    vaultNoVerifierBalanceBeforeFail === vaultNoVerifierBalanceAfterFail,
    "Scenario 6 vault balance changed after missing-verifier rejection"
  );
  assertCondition(nullifierEUsed === false, "Scenario 6 nullifier should remain unused");

  report.scenarios.push({ name: "missing_verifier_rejected", pass: true });

  // Final consistency checks.
  const mainEscrow = await readEscrow(vaultHash, tokenHash);
  const mainTokenBalance = await readBalance(tokenHash, vaultHash);
  const noVerifierEscrow = await readEscrow(vaultNoVerifierHash, tokenHash);
  const noVerifierTokenBalance = await readBalance(tokenHash, vaultNoVerifierHash);

  assertCondition(mainEscrow === mainTokenBalance, "Main vault escrow mapping differs from token balance");
  assertCondition(noVerifierEscrow === noVerifierTokenBalance, "No-verifier vault escrow mapping differs from token balance");

  report.assertions.push({
    label: "main_vault_escrow_matches_token_balance",
    expected: mainTokenBalance,
    actual: mainEscrow,
    pass: true
  });
  report.assertions.push({
    label: "no_verifier_vault_escrow_matches_token_balance",
    expected: noVerifierTokenBalance,
    actual: noVerifierEscrow,
    pass: true
  });

  const ownerGasBalanceEnd = await gasContract.balanceOf(owner.address);
  report.assertions.push({
    label: "owner_gas_balance_end",
    expected: "> 0",
    actual: ownerGasBalanceEnd,
    pass: ownerGasBalanceEnd > 0
  });

  report.completedAtUtc = new Date().toISOString();
  report.success = true;

  const reportDir = path.join(__dirname, "..", "artifacts");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `testnet-e2e-${nowStamp()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(toJsonSafeValue(report), null, 2));

  console.log(`zNEP17 testnet e2e completed successfully.`);
  console.log(`Report: ${reportPath}`);
  console.log(`Main vault: ${vaultHash}`);
  console.log(`No-verifier vault: ${vaultNoVerifierHash}`);
  console.log(`Token: ${tokenHash}`);
  console.log(`Verifier: ${verifierHash}`);
}

main().catch((error) => {
  console.error(`zNEP17 testnet e2e failed: ${error && error.message ? error.message : error}`);
  process.exit(1);
});
