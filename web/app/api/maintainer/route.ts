import { NextResponse } from "next/server";
import { wallet, rpc, tx, u, sc } from "@cityofzion/neon-js";
import { poseidon2Bls } from "../../lib/blsPoseidon";
import { supabase } from "../../lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST() {
  try {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://testnet1.neo.coz.io:443";
    const vaultHash = process.env.NEXT_PUBLIC_VAULT_HASH;
    const maintainerWif = process.env.MAINTAINER_WIF;

    if (!vaultHash || !maintainerWif) {
      return NextResponse.json({ error: "Missing maintainer configuration (VAULT_HASH or MAINTAINER_WIF)." }, { status: 500 });
    }

    const account = new wallet.Account(maintainerWif);
    const rpcClient = new rpc.RPCClient(rpcUrl);

    // Fetch total leaves from contract
    const leafCountRes = await rpcClient.invokeFunction(vaultHash, "getLeafIndex", []);
    const leafCount = parseInt(leafCountRes.stack[0].value as string, 10) || 0;

    // Fetch the last known root leaf count from contract
    const lastCountRes = await rpcClient.invokeFunction(vaultHash, "getLastRootLeafCount", []);
    const lastCount = parseInt(lastCountRes.stack[0].value as string, 10) || 0;

    if (leafCount <= lastCount) {
        return NextResponse.json({ message: "Tree is already up to date.", currentLeaves: leafCount });
    }

    // Determine how many leaves are missing locally in Supabase
    const { count: localLeafCount, error: countErr } = await supabase
      .from('deposits')
      .select('*', { count: 'exact', head: true });
      
    if (countErr) {
       console.error("Supabase count error:", countErr);
    }
    
    const dbLeavesCount = localLeafCount || 0;
    
    // Fetch missing leaves from on-chain and store them
    const newLeavesToInsert = [];
    for (let i = dbLeavesCount; i < leafCount; i++) {
        const leafRes = await rpcClient.invokeFunction(vaultHash, "getLeaf", [sc.ContractParam.integer(i)]);
        const hex = Buffer.from(leafRes.stack[0].value as string, 'base64').toString('hex');
        newLeavesToInsert.push({ leaf_index: i, leaf_hash: hex });
    }
    
    if (newLeavesToInsert.length > 0) {
        const { error: insertErr } = await supabase.from('deposits').insert(newLeavesToInsert);
        if (insertErr) {
            throw new Error(`Failed to save leaves to Supabase: ${insertErr.message}`);
        }
    }

    // Now query ALL leaves from Supabase to construct the tree
    const { data: allLeavesData, error: fetchErr } = await supabase
      .from('deposits')
      .select('leaf_index, leaf_hash')
      .order('leaf_index', { ascending: true });
      
    if (fetchErr || !allLeavesData) {
        throw new Error(`Failed to fetch leaves from Supabase: ${fetchErr?.message}`);
    }

    // Map to BigInts
    const leaves = allLeavesData.map(d => BigInt("0x" + d.leaf_hash));

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

    // Send transaction to N3
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

    const versionRes = await rpcClient.getVersion();
    const networkMagic = versionRes.protocol.network;
    const signedTx = transaction.sign(account, networkMagic);
    const txid = await rpcClient.sendRawTransaction(signedTx);
    
    // Save the new root to DB
    await supabase.from('merkle_roots').insert({
        leaf_count: leafCount,
        root_hash: newRootHex,
        tx_hash: txid
    });

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
