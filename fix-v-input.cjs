const fs = require('fs');

const path = 'src/zNEP17.Verifier/zNEP17Groth16Verifier.cs';
let vc = fs.readFileSync(path, 'utf8');

vc = vc.replace(/UInt160 asset,\s*byte\[\] commitment\)/g, 'UInt160 asset)');

fs.writeFileSync(path, vc);
