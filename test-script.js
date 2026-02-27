const fs = require('fs');
const wc = require("./circuits/withdraw_js/witness_calculator.js");
async function main() {
    const wasm = fs.readFileSync("circuits/withdraw_js/withdraw.wasm");
    const calculator = await wc(wasm);
    
    // I can patch the `witness_calculator.js` locally to print out all comparisons!
    // Specifically `assert` fails on line 59.
    // In `withdraw_js/witness_calculator.js`, look for `assert(val) { if (!val) throw new Error("Assert Failed"); }`
}
main();
