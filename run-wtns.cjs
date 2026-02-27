const snarkjs = require('./web/node_modules/snarkjs');
const fs = require('fs');
const { poseidon1Bls, poseidon4Bls, poseidon2Bls } = require('./scripts/lib/bls-poseidon.cjs');

async function packGroth16ProofForNeo(proof) {
  const { unstringifyBigInts } = require("./web/node_modules/ffjavascript").utils;
  const ffjavascript = require('./web/node_modules/ffjavascript');
  const curve = await ffjavascript.getCurveFromName('bls12381');

  const COMPRESSED_FLAG = 0x80;
  const INFINITY_FLAG = 0x40;
  const SIGN_FLAG = 0x20;

  function convertFfCompressedToNeo(bytes) {
    const output = Uint8Array.from(bytes);
    const ffSign = (output[0] & COMPRESSED_FLAG) !== 0;
    const ffInfinity = (output[0] & INFINITY_FLAG) !== 0;
    output[0] &= 0x1f;
    output[0] |= COMPRESSED_FLAG;
    if (ffInfinity) output[0] |= INFINITY_FLAG;
    if (ffSign) output[0] |= SIGN_FLAG;
    return output;
  }

  function compressG1(P) {
    const out = new Uint8Array(48);
    curve.G1.toRprCompressed(out, 0, P);
    return convertFfCompressedToNeo(out);
  }

  function compressG2(P) {
    const out = new Uint8Array(96);
    curve.G2.toRprCompressed(out, 0, P);
    return convertFfCompressedToNeo(out);
  }

  const p_unstr = unstringifyBigInts(proof);
  const A = curve.G1.fromObject(p_unstr.pi_a);
  const B = curve.G2.fromObject(p_unstr.pi_b);
  const C = curve.G1.fromObject(p_unstr.pi_c);

  const aComp = compressG1(A);
  const bComp = compressG2(B);
  const cComp = compressG1(C);

  const packed = new Uint8Array(192);
  packed.set(aComp, 0);
  packed.set(bComp, 48);
  packed.set(cComp, 144);
  
  await curve.terminate();

  return Buffer.from(packed).toString('hex');
}

function normalizeHex32(hex) {
    if (hex.startsWith("0x")) hex = hex.slice(2);
    return hex.padStart(64, "0");
}

function toLittleEndianScalar(bigintValue) {
    const hex = bigintValue.toString(16).padStart(64, '0');
    const buf = Buffer.from(hex, "hex");
    return buf.reverse().toString("hex");
}

async function main() {
    // Ok, the proof I generated WAS FOR BLS12-381!
    // But then why did snarkjs fail saying "Curve of the witness does not match"?
    // BECAUSE the `withdraw_js/withdraw.wasm` generates a bn128 witness, but `circuits/withdraw_final.zkey` expects bls12381!
    // I NEED TO USE `circuits/bls/withdraw_js/withdraw.wasm`!!
    
    // Generate valid BLS12381 proof and public inputs!
    const nullifier = BigInt(12345);
    const secret = BigInt(67890);
    const amountIn = BigInt(10);
    const assetField = BigInt("0x0000000000000000000000000000000000003333");
    
    const nullifierHash = poseidon1Bls([nullifier]);
    const commitment = poseidon4Bls([nullifier, secret, amountIn, assetField]);
    
    let current = commitment;
    let pathElements = [];
    let pathIndices = [];
    for(let i=0; i<20; i++) {
        pathElements.push(0n);
        pathIndices.push(0);
        current = poseidon2Bls([current, 0n]);
    }
    const root = current;
    
    const amountWithdraw = BigInt(8);
    const fee = BigInt(2);
    const amountChange = amountIn - amountWithdraw - fee;
    
    const newNullifier = BigInt(111);
    const newSecret = BigInt(222);
    const newCommitment = poseidon4Bls([newNullifier, newSecret, amountChange, assetField]);
    
    const recipientHex = "7f9acb9b3537c3b9ee4cb97a5656b595f072b665";
    const relayerHex = "7f9acb9b3537c3b9ee4cb97a5656b595f072b665";
    const recipient = BigInt("0x" + Buffer.from(recipientHex, 'hex').reverse().toString('hex'));
    const relayer = BigInt("0x" + Buffer.from(relayerHex, 'hex').reverse().toString('hex'));
    
    const witnessInput = {
      root: root.toString(),
      nullifierHash: nullifierHash.toString(),
      recipient: recipient.toString(),
      relayer: relayer.toString(),
      fee: fee.toString(),
      asset: assetField.toString(),
      amountWithdraw: amountWithdraw.toString(),
      newCommitment: newCommitment.toString(),
      nullifier: nullifier.toString(),
      secret: secret.toString(),
      amountIn: amountIn.toString(),
      newNullifier: newNullifier.toString(),
      newSecret: newSecret.toString(),
      amountChange: amountChange.toString(),
      pathElements: pathElements.map(x=>x.toString()),
      pathIndices: pathIndices
    };
    
    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      witnessInput,
      "circuits/bls/withdraw_js/withdraw.wasm",
      "circuits/bls/withdraw_final.zkey"
    );
    
    const proofHex = await packGroth16ProofForNeo(proof);
    
    let publicInputsHex = "";
    publicInputsHex += toLittleEndianScalar(BigInt(publicSignals[0])); // root
    publicInputsHex += toLittleEndianScalar(BigInt(publicSignals[1])); // nullifierHash
    publicInputsHex += toLittleEndianScalar(BigInt(publicSignals[2])); // recipient
    publicInputsHex += toLittleEndianScalar(BigInt(publicSignals[3])); // relayer
    publicInputsHex += toLittleEndianScalar(BigInt(publicSignals[4])); // fee
    publicInputsHex += toLittleEndianScalar(BigInt(publicSignals[5])); // asset
    publicInputsHex += toLittleEndianScalar(BigInt(publicSignals[6])); // amountWithdraw
    publicInputsHex += toLittleEndianScalar(BigInt(publicSignals[7])); // newCommitment
    
    const fixture = {
        asset: "0000000000000000000000000000000000003333",
        recipient: recipientHex,
        relayer: relayerHex,
        amount: amountWithdraw.toString(),
        fee: fee.toString(),
        merkleRoot: Buffer.from(toLittleEndianScalar(BigInt(publicSignals[0])), 'hex').reverse().toString('hex'),
        nullifierHash: Buffer.from(toLittleEndianScalar(BigInt(publicSignals[1])), 'hex').reverse().toString('hex'),
        commitment: Buffer.from(toLittleEndianScalar(BigInt(publicSignals[7])), 'hex').reverse().toString('hex'),
        proofHex: proofHex,
        publicInputsHex: publicInputsHex
    };
    
    fs.writeFileSync("tests/zNEP17.Protocol.Tests/Fixtures/valid_withdraw_fixture.json", JSON.stringify(fixture, null, 2));
    console.log("Fixture generated successfully!");
}
main();
