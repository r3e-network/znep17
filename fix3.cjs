const fs = require('fs');

const pPath = 'src/zNEP17.Protocol/PrivacyGuards.cs';
let pContent = fs.readFileSync(pPath, 'utf8');

pContent = pContent.replace(/,\s*int commitmentLength/g, '');
pContent = pContent.replace(/&& commitmentLength == LeafLength\s*/g, '');

fs.writeFileSync(pPath, pContent);
