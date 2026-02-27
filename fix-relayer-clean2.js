const fs = require('fs');

let content = fs.readFileSync('web/app/api/relay/route.ts', 'utf8');

// The first 'let commitmentHex: string;' is in GET.
// The second is in POST. We only want to delete the one in POST.

content = content.replace(
    '    let commitmentHex: string;\n    let newCommitmentHex: string;\n',
    '    let newCommitmentHex: string;\n'
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

// Fix the array element
content = content.replace(
    '        BigInt(`0x${commitmentHex}`).toString(),',
    '        BigInt(`0x${newCommitmentHex}`).toString(),'
);

fs.writeFileSync('web/app/api/relay/route.ts', content);

