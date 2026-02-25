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

// Main Withdraw Circuit with UTXO Change Model
template Withdraw(levels) {
    // ---- Public Inputs ----
    signal input root;
    signal input nullifierHash;
    signal input recipient;
    signal input relayer;
    signal input fee;
    signal input asset;
    signal input amountWithdraw;
    signal input newCommitment;

    // ---- Private Inputs ----
    signal input nullifier;
    signal input secret;
    signal input amountIn;
    signal input newNullifier;
    signal input newSecret;
    signal input amountChange;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    // 1. Check Balance Equation
    amountIn === amountWithdraw + fee + amountChange;

    // 2. Calculate old commitment and nullifierHash
    component hasher = CommitmentHasher();
    hasher.nullifier <== nullifier;
    hasher.secret <== secret;
    hasher.amount <== amountIn;
    hasher.asset <== asset;
    nullifierHash === hasher.nullifierHash;

    // 3. Verify that the old leaf exists in the Merkle Tree at the given public root
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== hasher.commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // 4. Calculate new commitment for change
    component newHasher = CommitmentHasher();
    newHasher.nullifier <== newNullifier;
    newHasher.secret <== newSecret;
    newHasher.amount <== amountChange;
    newHasher.asset <== asset;
    newCommitment === newHasher.commitment;

    // 5. Bind public inputs to the proof to prevent front-running
    signal recipientSquare;
    signal relayerSquare;
    signal amountWithdrawSquare;
    signal feeSquare;
    signal assetSquare;
    signal newCommitmentSquare;
    
    recipientSquare <== recipient * recipient;
    relayerSquare <== relayer * relayer;
    amountWithdrawSquare <== amountWithdraw * amountWithdraw;
    feeSquare <== fee * fee;
    assetSquare <== asset * asset;
    newCommitmentSquare <== newCommitment * newCommitment;
}

component main {public [root, nullifierHash, recipient, relayer, fee, asset, amountWithdraw, newCommitment]} = Withdraw(20);
