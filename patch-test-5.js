const fs = require('fs');

let code = fs.readFileSync('tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs', 'utf8');

code = code.replace(
`        engine.SetTransactionSigners(owner);
        verifier.Result = false;
        vault.Verifier = verifier.Hash;
        vault.Relayer = owner.Account;
        vault.SetAssetAllowed(token.Hash, true);


        engine.SetTransactionSigners(depositor);
        byte[] leaf = NewFixedBytes(0x61);
        token.Transfer(
            depositor.Account,
            vault.Hash,
            10,
            new object[] { stealth, leaf });

        byte[] root = PublishRoot(engine, vault, owner, 0x62);
        byte[] nullifier = NewFixedBytes(0x62);`,
`        engine.SetTransactionSigners(owner);
        verifier.Result = true;
        vault.Verifier = verifier.Hash;
        vault.Relayer = owner.Account;
        vault.SetAssetAllowed(token.Hash, true);


        engine.SetTransactionSigners(depositor);
        byte[] leaf = NewFixedBytes(0x61);
        token.Transfer(
            depositor.Account,
            vault.Hash,
            10,
            new object[] { stealth, leaf });

        byte[] root = PublishRoot(engine, vault, owner, 0x62);
        engine.SetTransactionSigners(owner);
        verifier.Result = false;
        byte[] nullifier = NewFixedBytes(0x62);`
);

fs.writeFileSync('tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs', code);
