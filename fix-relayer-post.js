const fs = require('fs');

let content = fs.readFileSync('web/app/api/relay/route.ts', 'utf8');

// Replace body.commitment with body.newCommitment for the index check!
// We can just completely remove body.commitment!

content = content.replace(
    'let commitmentHex: string;\n',
    ''
);
content = content.replace(
    '      commitmentHex = normalizeHex32(body.commitment, "commitment");\n',
    ''
);
content = content.replace(
    'getCommitmentIndexOnChain(vaultScriptHash, commitmentHex)',
    'getCommitmentIndexOnChain(vaultScriptHash, newCommitmentHex)'
);
content = content.replace(
    'if (commitmentIndex < 0) {\n      await unlockNullifier();\n      return NextResponse.json({ error: "Commitment not found in vault tree." }, { status: 400 });\n    }',
    'if (commitmentIndex >= 0) {\n      await unlockNullifier();\n      return NextResponse.json({ error: "New commitment already exists in vault tree." }, { status: 409 });\n    }'
);

// We need to also fix the expectedPublicInputs array in case it used commitmentHex
content = content.replace(
    'BigInt(`0x${commitmentHex}`).toString()',
    'BigInt(`0x${newCommitmentHex}`).toString()'
);

fs.writeFileSync('web/app/api/relay/route.ts', content);

let policyTest = fs.readFileSync('web/app/api/relay/route.policy.test.ts', 'utf8');
policyTest = policyTest.replace(/commitment: `0x\${"11"\.repeat\(32\)}`,\n/g, '');
policyTest = policyTest.replace(/commitment: `0x\${"11"\.repeat\(32\)}`,/g, '');

const testPattern = /it\("rejects malformed proof commitment before tree processing", async \(\) => {[\s\S]*?}\);\n\n/g;
policyTest = policyTest.replace(testPattern, '');

fs.writeFileSync('web/app/api/relay/route.policy.test.ts', policyTest);
