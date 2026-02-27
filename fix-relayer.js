const fs = require('fs');

let content = fs.readFileSync('web/app/api/relay/route.ts', 'utf8');

// Strip out all references to commitmentHex (old commitment)

content = content.replace(
    'async function getCommitmentIndexOnChain(vaultScriptHash: string, commitmentHex: string): Promise<number> {\n  try {\n    return await callVaultIntegerMethod(vaultScriptHash, "getCommitmentIndex", commitmentHex);\n  } catch {\n    return await callVaultIntegerMethod(vaultScriptHash, "GetCommitmentIndex", commitmentHex);\n  }\n}',
    ''
);

content = content.replace(
    '      const commitmentIndex = await getCommitmentIndexOnChain(vaultScriptHash, commitmentHex);\n      if (commitmentIndex < 0) {\n        return NextResponse.json(\n          { error: "Commitment not found in tree." },\n          { status: 404, headers: { "Cache-Control": "no-store" } },\n        );\n      }\n      const tree = await getOrBuildMerkleTree(vaultScriptHash);\n      if (commitmentIndex >= tree.leafCount) {\n        return NextResponse.json(\n          { error: "Commitment index exceeds current tree size." },\n          { status: 503, headers: { "Cache-Control": "no-store" } },\n        );\n      }\n      const target = BigInt(`0x${commitmentHex}`);\n      const treeLeaf = tree.layers[0][commitmentIndex] ?? 0n;\n      if (treeLeaf !== target) {\n        cachedMerkleTree = null;\n        const rebuilt = await getOrBuildMerkleTree(vaultScriptHash);\n        const rebuiltLeaf = rebuilt.layers[0][commitmentIndex] ?? 0n;\n        if (rebuiltLeaf !== target) {\n          return NextResponse.json(\n            { error: "Commitment does not match tree index." },\n            { status: 409, headers: { "Cache-Control": "no-store" } },\n          );\n        }\n      }',
    ''
);

content = content.replace(
    '      let commitmentHex: string;\n      try {\n        commitmentHex = normalizeHex32(proofCommitment, "proof commitment");\n      } catch (error: unknown) {\n        const message = error instanceof Error ? error.message : "Invalid proof commitment.";\n        return NextResponse.json({ error: message }, { status: 400 });\n      }',
    ''
);

content = content.replace(
    '    let commitmentHex: string;\n',
    ''
);

content = content.replace(
    '      commitmentHex = normalizeHex32(body.commitment, "commitment");\n',
    ''
);

content = content.replace(
    '      getCommitmentIndexOnChain(vaultScriptHash, commitmentHex),\n',
    ''
);

content = content.replace(
    '    const [knownRoot, usedNullifier, commitmentIndex] = await Promise.all([\n      isKnownRootOnChain(vaultScriptHash, merkleRootHex),\n      isNullifierUsedOnChain(vaultScriptHash, nullifierHashHex),\n    ]);',
    '    const [knownRoot, usedNullifier] = await Promise.all([\n      isKnownRootOnChain(vaultScriptHash, merkleRootHex),\n      isNullifierUsedOnChain(vaultScriptHash, nullifierHashHex),\n    ]);'
)

content = content.replace(
    '    if (commitmentIndex < 0) {\n      await unlockNullifier();\n      return NextResponse.json({ error: "Commitment not found in vault tree." }, { status: 400 });\n    }\n',
    ''
)

fs.writeFileSync('web/app/api/relay/route.ts', content);

let policyTest = fs.readFileSync('web/app/api/relay/route.policy.test.ts', 'utf8');

// Strip out commitment from test mocks
policyTest = policyTest.replace(/commitment: `0x\${"11"\.repeat\(32\)}`,\n/g, '');

// Also we need to fix the mock JSON request in testing
policyTest = policyTest.replace(/commitment: `0x\${"11"\.repeat\(32\)}`,/g, '');

// Strip the malformed commitment test
const testPattern = /it\("rejects malformed proof commitment before tree processing", async \(\) => {[\s\S]*?}\);\n\n/g;
policyTest = policyTest.replace(testPattern, '');

fs.writeFileSync('web/app/api/relay/route.policy.test.ts', policyTest);
