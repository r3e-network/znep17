const fs = require('fs');

let content = fs.readFileSync('web/app/api/relay/route.ts', 'utf8');

// In POST, replace the usage of commitmentHex with newCommitmentHex for the index check.
content = content.replace(
    'let commitmentHex: string;\n',
    ''
);
content = content.replace(
    '      commitmentHex = normalizeHex32(body.commitment, "commitment");\n',
    ''
);
content = content.replace(
    'getCommitmentIndexOnChain(vaultScriptHash, commitmentHex),\n    ]);',
    'getCommitmentIndexOnChain(vaultScriptHash, newCommitmentHex),\n    ]);'
);
content = content.replace(
    'if (commitmentIndex < 0) {\n      await unlockNullifier();\n      return NextResponse.json({ error: "Commitment not found in vault tree." }, { status: 400 });\n    }',
    'if (commitmentIndex >= 0) {\n      await unlockNullifier();\n      return NextResponse.json({ error: "New commitment already exists in vault tree." }, { status: 409 });\n    }'
);

content = content.replace(
    'BigInt(`0x${commitmentHex}`).toString()',
    'BigInt(`0x${newCommitmentHex}`).toString()'
);

fs.writeFileSync('web/app/api/relay/route.ts', content);

