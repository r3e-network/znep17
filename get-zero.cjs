const { poseidon2Bls } = require('./scripts/lib/bls-poseidon.cjs');
let h = 0n;
for (let i=0; i<20; i++) {
   h = poseidon2Bls([h, h]);
}
console.log("Empty root: " + h.toString(16).padStart(64, '0'));
