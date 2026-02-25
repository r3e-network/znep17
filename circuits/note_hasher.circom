pragma circom 2.0.0;
include "node_modules/circomlib/circuits/poseidon.circom";

template NoteHasher() {
  signal input nullifier;
  signal input secret;
  signal input amount;
  signal input asset;
  signal output nullifierHash;
  signal output commitment;

  component c = Poseidon(4);
  c.inputs[0] <== nullifier;
  c.inputs[1] <== secret;
  c.inputs[2] <== amount;
  c.inputs[3] <== asset;
  commitment <== c.out;

  component n = Poseidon(1);
  n.inputs[0] <== nullifier;
  nullifierHash <== n.out;
}

component main = NoteHasher();
