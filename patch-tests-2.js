const fs = require('fs');

const files = [
  'tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs',
  'tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs',
  'tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
      /vault\.UpdateMerkleRoot\(new byte\[192\], new byte\[160\], root\);/g,
      `vault.UpdateMerkleRoot(NewFixedBytes(0x01, 192), new byte[160], root);`
  );
  content = content.replace(
      /vault\.UpdateMerkleRoot\(new byte\[\] \{ 0x01 \}, new byte\[\] \{ 0x01 \}, NewFixedBytes\(0x89\)\)\);/g,
      `vault.UpdateMerkleRoot(NewFixedBytes(0x01, 192), new byte[160], NewFixedBytes(0x89)));`
  );
  fs.writeFileSync(file, content);
}
