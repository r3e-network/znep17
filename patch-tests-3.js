const fs = require('fs');

const files = [
  'tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs',
  'tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs',
  'tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
      /NewFixedBytes\(0x01, 192\)/g,
      `NewProof()`
  );
  content = content.replace(
      /private static byte\[\] NewFixedBytes\(byte b\)/g,
      `private static byte[] NewProof() { var p = new byte[192]; p[0] = 1; return p; }
    private static byte[] NewFixedBytes(byte b)`
  );
  fs.writeFileSync(file, content);
}
