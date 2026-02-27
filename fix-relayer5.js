const fs = require('fs');
let routeContent = fs.readFileSync('web/app/api/relay/route.ts', 'utf8');

const getCommitmentIndexRegex = /try \{\s*commitmentHex = normalizeHex32\(proofCommitment, "proof commitment"\);\s*\} catch \(error: unknown\) \{\s*const message = error instanceof Error \? error\.message : "Invalid proof commitment\.";\s*return NextResponse\.json\(\{ error: message \}, \{ status: 400 \}\);\s*\}/s;

routeContent = routeContent.replace(getCommitmentIndexRegex, '');

fs.writeFileSync('web/app/api/relay/route.ts', routeContent);
