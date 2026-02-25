pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/bitify.circom";
include "tree.circom";

// Computes Poseidon(nullifier, secret, amount, asset)
template CommitmentHasher() {
    signal input nullifier;
    signal input secret;
    signal input amount;
    signal input asset;
    signal output commitment;
    signal output nullifierHash;

    component commitmentHasher = Poseidon(4);
    commitmentHasher.inputs[0] <== nullifier;
    commitmentHasher.inputs[1] <== secret;
    commitmentHasher.inputs[2] <== amount;
    commitmentHasher.inputs[3] <== asset;
    commitment <== commitmentHasher.out;

    component nullifierHasher = Poseidon(1);
    nullifierHasher.inputs[0] <== nullifier;
    nullifierHash <== nullifierHasher.out;
}

// Main Withdraw Circuit
template Withdraw(levels) {
    // ---- Public Inputs ----
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input relayer;
    signal input amount;
    signal input fee;
    signal input asset;
    signal input commitment;

    // ---- Private Inputs ----
    // user's original deposit secret pair
    signal input nullifier;
    signal input secret;
    // merkle proof arrays
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // 1. Calculate commitment (leaf) and nullifierHash from the private inputs
    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.amount <== amount;
    hasher.asset <== asset;
    
    // 2. Constrain the calculated nullifierHash against the public input
    nullifierHash === hasher.nullifierHash;
    commitment === hasher.commitment;

    // 3. Verify that the leaf (commitment) exists in the Merkle Tree at the given public root
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // 4. Bind public inputs to the proof to prevent front-running
    // 
    // The relayer, recipient, amount, and fee are publicly passed to the verifier contract.
    // However, if we don't constrain them in the circuit, a malicious actor (or miner)
    // could take our valid proof and submit it with *their* address as the relayer or recipient,
    // thereby stealing the funds or fees.
    // 
    // By squaring or mathematically bounding them to a signal, we guarantee that 
    // the verifier checks that the Groth16 proof matches these EXACT public values.
    signal recipientSquare;
    signal relayerSquare;
    signal amountSquare;
    signal feeSquare;
    signal assetSquare;
    
    recipientSquare <== recipient * recipient;
    relayerSquare <== relayer * relayer;
    amountSquare <== amount * amount;
    feeSquare <== fee * fee;
    assetSquare <== asset * asset;
}

// Using a 20-level Merkle tree (approx 1 million deposits maximum limit)
component main {public [root, nullifierHash, recipient, relayer, amount, fee, asset]} = Withdraw(20);
