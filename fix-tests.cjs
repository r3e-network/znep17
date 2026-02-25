const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            results = results.concat(walk(file));
        } else { 
            if (file.endsWith('.cs')) results.push(file);
        }
    });
    return results;
}

const testFiles = walk('tests');

testFiles.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');

    // Remove commitment from Withdraw method calls
    // Withdraw(asset, proof, publicInputs, merkleRoot, nullifierHash, commitment, recipient, relayer, amount, fee)
    // Needs to be: Withdraw(asset, proof, publicInputs, merkleRoot, nullifierHash, recipient, relayer, amount, fee)
    
    // Using regex to remove 6th argument of Withdraw
    content = content.replace(/(\.Withdraw\([\s\S]*?,\s*[\s\S]*?,\s*[\s\S]*?,\s*[\s\S]*?,\s*[^,]+),\s*[^,]+(,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+)\)/g, '$1$2)');

    // For Verify
    content = content.replace(/(\.Verify\([\s\S]*?,\s*[\s\S]*?,\s*[\s\S]*?,\s*[\s\S]*?,\s*[^,]+),\s*[^,]+(,\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*[^,]+)\)/g, '$1$2)');
    
    // For PrivacyGuards checks
    // IsValidWithdrawRequest(bool, bool, bool, BigInteger, BigInteger, int, int, int, int, int)
    // removed commitmentLength, so 9 ints total
    content = content.replace(/(PrivacyGuards\.IsValidWithdrawRequest\([\s\S]*?,\s*[\s\S]*?,\s*[\s\S]*?,\s*[\s\S]*?,\s*[\s\S]*?,\s*[^,]+,\s*[^,]+),\s*[^,]+(,\s*[^,]+,\s*[^,]+)\)/g, '$1$2)');

    // Emergency withdraw methods deletion
    if (file.includes('GovernanceBehaviorTests.cs')) {
        content = content.replace(/\[TestMethod\]\s*public void TestEmergencyWithdrawEnableAndExecute.*?\n\s*\}\s*?\n/gs, '');
        content = content.replace(/\[TestMethod\]\s*public void TestEmergencyWithdrawDisable.*?\n\s*\}\s*?\n/gs, '');
        content = content.replace(/\[TestMethod\]\s*public void TestEmergencyWithdrawRequiresPause.*?\n\s*\}\s*?\n/gs, '');
        content = content.replace(/\[TestMethod\]\s*public void TestEmergencyWithdrawDoubleSpend.*?\n\s*\}\s*?\n/gs, '');
    }

    if (file.includes('WithdrawBehaviorTests.cs')) {
        content = content.replace(/\[TestMethod\]\s*public void TestEmergencyWithdrawRequestValidation.*?\n\s*\}\s*?\n/gs, '');
    }
    
    // Znep17IntegrationTests
    if (file.includes('Znep17IntegrationTests.cs')) {
        content = content.replace(/\[TestMethod\]\s*public void TestEmergencyWithdrawMode.*?\n\s*\}\s*?\n/gs, '');
        content = content.replace(/\[TestMethod\]\s*public void TestEmergencyWithdrawBeforeAvailable.*?\n\s*\}\s*?\n/gs, '');
    }

    fs.writeFileSync(file, content);
});

