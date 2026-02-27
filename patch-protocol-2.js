const fs = require('fs');
let code = fs.readFileSync('src/zNEP17.Protocol/zNEP17Protocol.cs', 'utf8');

code = code.replace(
`    public static void SetTreeMaintainer(UInt160 maintainer)
    {
        ExecutionEngine.Assert(maintainer.IsValidAndNotZero, "invalid tree maintainer address");
        AssertOwnerWitness();
        Storage.Put(KeyTreeMaintainer, (byte[])maintainer);
    }`, '');

code = code.replace(
    `oldRoot = Convert.FromHexString("500d7edac24935fb5738441c8f3778bcb71449c552c756383dc986dc499d6322");`,
    `oldRoot = (byte[])new byte[] { 0x50, 0x0d, 0x7e, 0xda, 0xc2, 0x49, 0x35, 0xfb, 0x57, 0x38, 0x44, 0x1c, 0x8f, 0x37, 0x78, 0xbc, 0xb7, 0x14, 0x49, 0xc5, 0x52, 0xc7, 0x56, 0x38, 0x3d, 0xc9, 0x86, 0xdc, 0x49, 0x9d, 0x63, 0x22 };`
);

fs.writeFileSync('src/zNEP17.Protocol/zNEP17Protocol.cs', code);
