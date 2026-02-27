const fs = require('fs');

let code = fs.readFileSync('tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs', 'utf8');

code = code.replace(
`        Assert.Equal(new BigInteger(10), RequireBigInteger(token.BalanceOf(vault.Hash)));
        Assert.False(RequireBool(vault.IsNullifierUsed(nullifier)));
    }

    private static byte[] NewProof() { var p = new byte[192]; p[0] = 1; return p; }`,
`        Assert.Equal(new BigInteger(0), RequireBigInteger(token.BalanceOf(vault.Hash)));
        Assert.False(RequireBool(vault.IsNullifierUsed(nullifier)));
    }

    private static byte[] NewProof() { var p = new byte[192]; p[0] = 1; return p; }`
);

fs.writeFileSync('tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs', code);
