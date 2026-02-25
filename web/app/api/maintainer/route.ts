import { NextResponse } from "next/server";
import { wallet, rpc, tx, u, sc } from "@cityofzion/neon-js";
import { poseidon2Bls } from "../../lib/blsPoseidon";

export async function POST() {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://testnet1.neo.coz.io:443";
    const vaultHash = process.env.NEXT_PUBLIC_VAULT_HASH;
    const maintainerWif = process.env.MAINTAINER_WIF;

    if (!vaultHash || !maintainerWif) {
      return NextResponse.json({ error: "Missing maintainer configuration." }, { status: 500 });
    }

    const account = new wallet.Account(maintainerWif);
    const rpcClient = new rpc.RPCClient(rpcUrl);

    const leafCountRes = await rpcClient.invokeFunction(vaultHash, "getLeafIndex", []);
    const leafCount = parseInt(leafCountRes.stack[0].value as string, 10) || 0;

    const lastCountRes = await rpcClient.invokeFunction(vaultHash, "getLastRootLeafCount", []);
    const lastCount = parseInt(lastCountRes.stack[0].value as string, 10) || 0;

    if (leafCount <= lastCount) {
        return NextResponse.json({ message: "Tree is already up to date.", currentLeaves: leafCount });
    }

    const leaves: bigint[] = [];
    for (let i = 0; i < leafCount; i++) {
        const leafRes = await rpcClient.invokeFunction(vaultHash, "getLeaf", [sc.ContractParam.integer(i)]);
        const hex = Buffer.from(leafRes.stack[0].value as string, 'base64').toString('hex');
        leaves.push(BigInt("0x" + hex));
    }

    const MERKLE_DEPTH = 20;
    let currentLevel = leaves;
    let emptyHash = 0n;

    for (let level = 0; level < MERKLE_DEPTH; level++) {
        const nextLevel: bigint[] = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : emptyHash;
            nextLevel.push(poseidon2Bls([left, right]));
        }
        emptyHash = poseidon2Bls([emptyHash, emptyHash]);
        currentLevel = nextLevel;
    }

    const newRoot = currentLevel[0];
    let newRootHex = newRoot.toString(16);
    while (newRootHex.length < 64) newRootHex = "0" + newRootHex;

    const script = sc.createScript({
        scriptHash: vaultHash,
        operation: "updateMerkleRoot",
        args: [sc.ContractParam.byteArray(newRootHex)]
    });

    const currentHeight = await rpcClient.getBlockCount();
    const transaction = new tx.Transaction({
        signers: [
            {
                account: account.scriptHash,
                scopes: tx.WitnessScope.CalledByEntry
            }
        ],
        validUntilBlock: currentHeight + 1000,
        script
    });

    const networkFee = await rpcClient.calculateNetworkFee(transaction);
    transaction.networkFee = u.BigInteger.fromNumber(networkFee);
    transaction.systemFee = u.BigInteger.fromNumber(100000000); 

    const networkMagic = await rpcClient.getVersion().then(v => v.protocol.network);
    const signedTx = transaction.sign(account, networkMagic);
    const txid = await rpcClient.sendRawTransaction(signedTx);

    return NextResponse.json({ 
        success: true, 
        message: "Merkle root updated successfully.", 
        txid, 
        newRoot: newRootHex,
        leavesProcessed: leafCount
    });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
