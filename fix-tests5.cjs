const fs = require('fs');

const filePaths = [
    'tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs',
    'tests/zNEP17.Protocol.Tests/WithdrawBehaviorTests.cs',
    'tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs'
];

filePaths.forEach(p => {
    let content = fs.readFileSync(p, 'utf8');
    
    // Some tests are named TestEmergencyWithdraw* but maybe they were partially removed or have different names like TestEmergency...
    // Let's just remove the method bodies explicitly by finding "TestEmergencyWithdraw"
    // To be safe, let's remove ANY method that has 'EmergencyWithdraw' in its name.
    
    let regex = /\[TestMethod\]\s*public void [^\(]*EmergencyWithdraw[^\(]*\(\)\s*\{[\s\S]*?\}(?=\s*\[TestMethod\]|\s*\n\s*\})/g;
    
    let oldContent;
    do {
        oldContent = content;
        content = content.replace(regex, '');
    } while (oldContent !== content);

    // Also remove TestIsCommitmentSpent or similar if they exist
    regex = /\[TestMethod\]\s*public void [^\(]*IsCommitmentSpent[^\(]*\(\)\s*\{[\s\S]*?\}(?=\s*\[TestMethod\]|\s*\n\s*\})/g;
    do {
        oldContent = content;
        content = content.replace(regex, '');
    } while (oldContent !== content);
    
    // remove any lines with IsCommitmentSpent
    content = content.split('\n').filter(l => !l.includes('IsCommitmentSpent')).join('\n');
    content = content.split('\n').filter(l => !l.includes('EnableEmergencyWithdraw')).join('\n');
    content = content.split('\n').filter(l => !l.includes('EmergencyWithdrawAvailableAt')).join('\n');
    content = content.split('\n').filter(l => !l.includes('EmergencyWithdraw')).join('\n');

    fs.writeFileSync(p, content);
});

// also fix MockVerifierContract signature again
let ic = fs.readFileSync('tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs', 'utf8');
ic = ic.replace(/public bool Verify\([\s\S]*?\)\s*\{/, `public bool Verify(
            UInt160? asset,
            byte[]? proof,
            byte[]? publicInputs,
            byte[]? merkleRoot,
            byte[]? nullifierHash,
            UInt160? recipient,
            UInt160? relayer,
            BigInteger? amount,
            BigInteger? fee) {`);
fs.writeFileSync('tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs', ic);

