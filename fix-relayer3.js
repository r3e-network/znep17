const fs = require('fs');
let routeContent = fs.readFileSync('web/app/api/relay/route.ts', 'utf8');

routeContent = routeContent.replace(
    '      const commitmentIndex = await getCommitmentIndexOnChain(vaultScriptHash, commitmentHex);\n      if (commitmentIndex < 0) {\n        return NextResponse.json(\n          { error: "Commitment not found in tree." },\n          { status: 404, headers: { "Cache-Control": "no-store" } },\n        );\n      }\n      const tree = await getOrBuildMerkleTree(vaultScriptHash);\n      if (commitmentIndex >= tree.leafCount) {\n        return NextResponse.json(\n          { error: "Commitment index exceeds current tree size." },\n          { status: 503, headers: { "Cache-Control": "no-store" } },\n        );\n      }\n      const target = BigInt(`0x${commitmentHex}`);\n      const treeLeaf = tree.layers[0][commitmentIndex] ?? 0n;\n      if (treeLeaf !== target) {\n        cachedMerkleTree = null;\n        const rebuilt = await getOrBuildMerkleTree(vaultScriptHash);\n        const rebuiltLeaf = rebuilt.layers[0][commitmentIndex] ?? 0n;\n        if (rebuiltLeaf !== target) {\n          return NextResponse.json(\n            { error: "Commitment does not match tree index." },\n            { status: 409, headers: { "Cache-Control": "no-store" } },\n          );\n        }\n      }',
    ''
);

fs.writeFileSync('web/app/api/relay/route.ts', routeContent);
