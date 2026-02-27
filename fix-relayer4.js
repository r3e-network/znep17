const fs = require('fs');
let routeContent = fs.readFileSync('web/app/api/relay/route.ts', 'utf8');

const pattern = /      const commitmentIndex = await getCommitmentIndexOnChain\(vaultScriptHash, commitmentHex\);\n[\s\S]*?            { status: 409, headers: { "Cache-Control": "no-store" } },\n          \);\n        }\n      }/;

routeContent = routeContent.replace(pattern, '');
fs.writeFileSync('web/app/api/relay/route.ts', routeContent);
