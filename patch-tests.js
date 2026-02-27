const fs = require('fs');

const files = [
  'tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs',
  'tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs',
  'tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
      /vault\.UpdateMerkleRoot\(new byte\[\] \{ 0x89 \}, 0\);/g,
      `vault.UpdateMerkleRoot(new byte[] { 0x01 }, new byte[] { 0x01 }, new byte[] { 0x89 });`
  );
  content = content.replace(
      /vault\.UpdateMerkleRoot\(NewFixedBytes\(0x89\), 0\)\);/g,
      `vault.UpdateMerkleRoot(new byte[] { 0x01 }, new byte[] { 0x01 }, NewFixedBytes(0x89)));`
  );
  content = content.replace(
      /vault\.UpdateMerkleRoot\(root, leafCount\);/g,
      `vault.UpdateMerkleRoot(new byte[192], new byte[160], root);`
  );
  fs.writeFileSync(file, content);
}
