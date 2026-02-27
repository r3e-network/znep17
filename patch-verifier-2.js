const fs = require('fs');

let code = fs.readFileSync('src/zNEP17.Verifier/zNEP17Groth16Verifier.cs', 'utf8');

code = code.replace(
    'object mul = CryptoLib.Bls12381Multiply(icPoint, scalar);',
    'object mul = CryptoLib.Bls12381Mul(icPoint, scalar, false);'
);

fs.writeFileSync('src/zNEP17.Verifier/zNEP17Groth16Verifier.cs', code);
