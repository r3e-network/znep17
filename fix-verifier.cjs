const fs = require('fs');
const vPath = 'src/zNEP17.Verifier/zNEP17Groth16Verifier.cs';
let vc = fs.readFileSync(vPath, 'utf8');

vc = vc.replace(/byte\[\] commitment,\s*/g, '');
vc = vc.replace(/if \(commitment is null \|\| commitment\.Length != 32\)\s*return false;\s*/g, '');
vc = vc.replace(/, commitment\)/g, ')');
vc = vc.replace(/, byte\[\] commitment\)/g, ')');
vc = vc.replace(/byte\[\] commitmentSquare/g, '');

// Also fixing the ValidatePublicInputs inside zNEP17Groth16Verifier.cs
vc = vc.replace(/if \(!TryEncodeUInt256Scalar\(commitment, out byte\[\] commitmentScalar\)\)\s*return false;\s*/g, '');
vc = vc.replace(/if \(!TryEncodeUInt256SquareScalar\(commitment, out byte\[\] commitmentSquareScalar\)\)\s*return false;\s*/g, '');

// Remove it from the buffer builder
vc = vc.replace(/Slice\(commitmentSquareScalar, 0, 32\),\s*/g, '');

fs.writeFileSync(vPath, vc);
