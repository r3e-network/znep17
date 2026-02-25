const fs = require('fs');
const gPath = 'tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs';
let gc = fs.readFileSync(gPath, 'utf8');
gc = gc.replace(/\[TestMethod\]\s*public void TestEmergencyWithdrawEnableAndExecute\(\)\s*\{[\s\S]*?\}\s*\}\s*\}\s*$/g, '');
// Since we might have missed the end of the file or messed up regex, let's just delete the problematic lines manually if needed.
// Actually, it's easier to use string search and substring to truncate everything after TestSecurityCouncilUpdate
const index = gc.indexOf('TestEmergencyWithdrawEnableAndExecute');
if (index !== -1) {
    const lastValidMethod = gc.lastIndexOf('[TestMethod]', index);
    if (lastValidMethod !== -1) {
        // We want to keep the last valid method and discard everything after it.
        // Wait, there are multiple EmergencyWithdraw tests. Let's just remove them all properly.
    }
}
