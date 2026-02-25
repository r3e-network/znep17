const fs = require('fs');

const path = 'src/zNEP17.Protocol/zNEP17Protocol.cs';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/nullifierLengthLength/g, 'nullifierLength');
content = content.replace(/nullifierHash!!/g, 'nullifierHash!');
content = content.replace(/ExecutionEngine\.Assert\(CommitmentAssetMap\(\)\.Get\(leaf!\) is null, "commitment already exists"\);\s*/g, '');

fs.writeFileSync(path, content);
