pragma circom 2.0.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/mux1.circom";
include "node_modules/circomlib/circuits/bitify.circom";

template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;
    hash <== hasher.out;
}

template DualMux() {
    signal input in[2];
    signal input s;
    signal output out[2];

    s * (1 - s) === 0;
    out[0] <== (in[1] - in[0])*s + in[0];
    out[1] <== (in[0] - in[1])*s + in[1];
}

template MerkleTreeUpdater(levels) {
    signal input oldRoot;
    signal input newRoot;
    signal input oldLeaf;
    signal input newLeaf;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component selectorsOld[levels];
    component hashersOld[levels];
    
    component selectorsNew[levels];
    component hashersNew[levels];

    for (var i = 0; i < levels; i++) {
        selectorsOld[i] = DualMux();
        selectorsOld[i].in[0] <== i == 0 ? oldLeaf : hashersOld[i - 1].hash;
        selectorsOld[i].in[1] <== pathElements[i];
        selectorsOld[i].s <== pathIndices[i];

        hashersOld[i] = HashLeftRight();
        hashersOld[i].left <== selectorsOld[i].out[0];
        hashersOld[i].right <== selectorsOld[i].out[1];

        selectorsNew[i] = DualMux();
        selectorsNew[i].in[0] <== i == 0 ? newLeaf : hashersNew[i - 1].hash;
        selectorsNew[i].in[1] <== pathElements[i];
        selectorsNew[i].s <== pathIndices[i];

        hashersNew[i] = HashLeftRight();
        hashersNew[i].left <== selectorsNew[i].out[0];
        hashersNew[i].right <== selectorsNew[i].out[1];
    }

    oldRoot === hashersOld[levels - 1].hash;
    newRoot === hashersNew[levels - 1].hash;
}

template Main(levels) {
    signal input oldRoot;
    signal input newRoot;
    signal input oldLeaf;
    signal input newLeaf;
    signal input leafIndex; // Packed integer
    signal input pathElements[levels];

    component num2bits = Num2Bits(levels);
    num2bits.in <== leafIndex;

    component updater = MerkleTreeUpdater(levels);
    updater.oldRoot <== oldRoot;
    updater.newRoot <== newRoot;
    updater.oldLeaf <== oldLeaf;
    updater.newLeaf <== newLeaf;
    
    for (var i = 0; i < levels; i++) {
        updater.pathIndices[i] <== num2bits.out[i];
        updater.pathElements[i] <== pathElements[i];
    }
}

component main {public [oldRoot, newRoot, oldLeaf, newLeaf, leafIndex]} = Main(20);
