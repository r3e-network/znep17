const fs = require('fs');

let gov = fs.readFileSync('tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs', 'utf8');

gov = gov.replace(
    /        var vault = DeployVault\(engine\);\s*var token = DeployToken\(engine\);\s*vault\.SetAssetAllowed\(token\.Hash, true\);/g,
    `        var vault = DeployVault(engine);
        var token = DeployToken(engine);
        var verifier = DeployVerifier(engine);
        verifier.Result = true;
        vault.Verifier = verifier.Hash;
        vault.SetAssetAllowed(token.Hash, true);`
);

fs.writeFileSync('tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs', gov);
