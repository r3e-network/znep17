const fs = require('fs');

const wPath = 'tests/zNEP17.Protocol.Tests/WithdrawBehaviorTests.cs';
let wc = fs.readFileSync(wPath, 'utf8');
wc = wc.replace(/\[TestMethod\]\s*public void TestEmergencyWithdraw.*?\n\s*\}\s*?\n/gs, '');
fs.writeFileSync(wPath, wc);

const gPath = 'tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs';
let gc = fs.readFileSync(gPath, 'utf8');
gc = gc.replace(/\[TestMethod\]\s*public void TestEmergencyWithdraw.*?\n\s*\}\s*?\n/gs, '');
fs.writeFileSync(gPath, gc);

const iPath = 'tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs';
let ic = fs.readFileSync(iPath, 'utf8');
ic = ic.replace(/\[TestMethod\]\s*public void TestEmergencyWithdraw.*?\n\s*\}\s*?\n/gs, '');
// And fix the mock
ic = ic.replace(/public class MockVerifierContract\s*\{[\s\S]*?\}\s*\}/, match => {
    return match.replace(/byte\[\]\? commitment,\s*/, '');
});
ic = ic.replace(/IsCommitmentSpent/g, 'IsNullifierUsed');
fs.writeFileSync(iPath, ic);

const rcPath = 'tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs';
let rcc = fs.readFileSync(rcPath, 'utf8');
rcc = rcc.replace(/IsCommitmentSpent/g, 'IsNullifierUsed');
fs.writeFileSync(rcPath, rcc);

