const snarkjs = require('./web/node_modules/snarkjs');
const fs = require('fs');
async function main() {
    // just test calculation with a simple dummy script using the built wasm, we can use the wasm to generate the exact hashes
    const wasmPath = "circuits/withdraw_js/withdraw.wasm";
    const witnessCalculator = require("./circuits/withdraw_js/witness_calculator.js");
    const wasmBuffer = fs.readFileSync(wasmPath);
    const wc = await witnessCalculator(wasmBuffer);
    
    // To extract a single hash, we could use a different circuit, but wait, the mismatch is at line 59:
    // nullifierHash === hasher.nullifierHash
    // My JS code generated: nullifierHash = poseidon1Bls([nullifier]);
    // What does the circom code generate?
    //     component nullifierHasher = Poseidon(1);
    //     nullifierHasher.inputs[0] <== nullifier;
    //     nullifierHash <== nullifierHasher.out;
    // But earlier we saw `Poseidon(2)` or something?
}
main();
