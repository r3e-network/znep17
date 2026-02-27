const fs = require('fs');

let gov = fs.readFileSync('tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs', 'utf8');

// replace the test body with a test that checks "no new leaves to update"
gov = gov.replace(
/    public void UpdateMerkleRoot_Rejects_StaleExpectedLeafCount\(\)[\s\S]*?Assert\.True\(RequireBool\(vault\.IsKnownRoot\(root\)\)\);\s*}/m,
`    public void UpdateMerkleRoot_Rejects_NoNewLeavesToUpdate()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);
        var verifier = DeployVerifier(engine);
        verifier.Result = true;
        vault.Verifier = verifier.Hash;

        // No deposits! So leafCount is 0, lastRootLeafCount is 0.
        engine.SetTransactionSigners(owner);
        Assert.Throws<TestException>(() => vault.UpdateMerkleRoot(NewProof(), new byte[160], NewFixedBytes(0x89)));
    }`
);

fs.writeFileSync('tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs', gov);
