const fs = require('fs');

const path = 'src/zNEP17.Protocol/zNEP17Protocol.cs';
let content = fs.readFileSync(path, 'utf8');

// There are a couple manual fixes
content = content.replace(/byte\[\] commitment!/g, ''); // just in case
content = content.replace(/commitment!,\s*/g, '');
content = content.replace(/, commitment!/g, '');
content = content.replace(/,\s*commitment/g, '');
content = content.replace(/commitmentLength,\s*/g, '');

content = content.replace(/byte\[\] publicInputs, byte\[\] merkleRoot, byte\[\] nullifierHash, UInt160 recipient/g, 'byte[] publicInputs, byte[] merkleRoot, byte[] nullifierHash, UInt160 recipient');
content = content.replace(/VerifyProof\(asset, proof!, publicInputs!, merkleRoot!, nullifierHash!, recipient, relayer, amount, fee\)/g, 'VerifyProof(asset, proof!, publicInputs!, merkleRoot!, nullifierHash!, recipient, relayer, amount, fee)');


// Fix PrivacyGuards
const privacyGuardsPath = 'src/zNEP17.Protocol/PrivacyGuards.cs';
let pgContent = fs.readFileSync(privacyGuardsPath, 'utf8');
pgContent = pgContent.replace(/, int commitmentLength/g, '');
pgContent = pgContent.replace(/commitmentLength == LeafLength && /g, '');
fs.writeFileSync(privacyGuardsPath, pgContent);

fs.writeFileSync(path, content);
