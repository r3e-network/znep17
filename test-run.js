const fs = require('fs');
const wc = require("./circuits/withdraw_js/witness_calculator.js");

async function main() {
    const wasm = fs.readFileSync("circuits/withdraw_js/withdraw.wasm");
    const calculator = await wc(wasm);

    const input = {
      root: "0",
      nullifierHash: "30210038655452570927876935731677491109181541264348558594944850742778338046562",
      recipient: "0",
      relayer: "0",
      fee: "2",
      asset: BigInt("0x0000000000000000000000000000000000003333").toString(),
      amountWithdraw: "8",
      newCommitment: "0",
      nullifier: "12345",
      secret: "67890",
      amountIn: "10",
      newNullifier: "111",
      newSecret: "222",
      amountChange: "0",
      pathElements: Array(20).fill("0"),
      pathIndices: Array(20).fill("0")
    };
    try {
        await calculator.calculateWitness(input, true);
    } catch(e) {
        console.log(e);
    }
}
main();
