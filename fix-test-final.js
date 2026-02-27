const fs = require('fs');

let content = fs.readFileSync('tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs', 'utf8');

// There is a method `PublishRoot` at the bottom of the test files!
content = content.replace(
    /vault\.UpdateMerkleRoot\(NewProof\(\), new byte\[160\], root\);/g,
    `vault.UpdateMerkleRoot(NewProof(), new byte[224], root);`
);
fs.writeFileSync('tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs', content);

content = fs.readFileSync('tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs', 'utf8');
content = content.replace(
    /vault\.UpdateMerkleRoot\(NewProof\(\), new byte\[160\], root\);/g,
    `vault.UpdateMerkleRoot(NewProof(), new byte[224], root);`
);
fs.writeFileSync('tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs', content);

content = fs.readFileSync('tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs', 'utf8');
content = content.replace(
    /vault\.UpdateMerkleRoot\(NewProof\(\), new byte\[160\], root\);/g,
    `vault.UpdateMerkleRoot(NewProof(), new byte[224], root);`
);
fs.writeFileSync('tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs', content);

// Wait! In `zNEP17Protocol.cs`: `ExecutionEngine.Assert(publicInputs is not null && publicInputs.Length == 160, "invalid public inputs");`
// The size of publicInputs for tree update is 5 public inputs (oldRoot, newRoot, oldLeaf, newLeaf, leafIndex)
// Wait! `VerificationKeyTreeUpdate.PublicInputCount = 5` => 5 * 32 = 160.
// So `new byte[160]` IS CORRECT.
