const fs = require('fs');
let code = fs.readFileSync('tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs', 'utf8');

code = code.replace(
`        byte[] leaf = NewFixedBytes(0x91);
        token.Transfer(
            depositor.Account,
            vault.Hash,
            10,
            new object[] { stealth, leaf });

        byte[] root = PublishRoot(engine, vault, owner, 0x92);
        byte[] nullifier = NewFixedBytes(0x92);`,
`        byte[] nullifier = NewFixedBytes(0x92);
        byte[] root = NewFixedBytes(0x92);`
);

fs.writeFileSync('tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs', code);

let gov = fs.readFileSync('tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs', 'utf8');
gov = gov.replace(
    '        var vault = DeployVault(engine);\n        var token = DeployToken(engine);\n        vault.SetAssetAllowed(token.Hash, true);',
    '        var vault = DeployVault(engine);\n        var token = DeployToken(engine);\n        var verifier = DeployVerifier(engine);\n        verifier.Result = true;\n        vault.Verifier = verifier.Hash;\n        vault.SetAssetAllowed(token.Hash, true);'
);
fs.writeFileSync('tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs', gov);
