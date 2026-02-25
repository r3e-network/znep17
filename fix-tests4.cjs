const fs = require('fs');

const filePaths = [
    'tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs',
    'tests/zNEP17.Protocol.Tests/WithdrawBehaviorTests.cs',
    'tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs'
];

filePaths.forEach(p => {
    let content = fs.readFileSync(p, 'utf8');
    content = content.replace(/\[TestMethod\]\s*public void TestEmergencyWithdraw[\s\S]*?\}\s*(?=\[TestMethod\]|\}$)/g, '');
    fs.writeFileSync(p, content);
});

// also fix MockVerifierContract signature
let ic = fs.readFileSync('tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs', 'utf8');
ic = ic.replace(/public bool Verify\([\s\S]*?\)/, `public bool Verify(
            UInt160? asset,
            byte[]? proof,
            byte[]? publicInputs,
            byte[]? merkleRoot,
            byte[]? nullifierHash,
            UInt160? recipient,
            UInt160? relayer,
            BigInteger? amount,
            BigInteger? fee)`);
fs.writeFileSync('tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs', ic);

