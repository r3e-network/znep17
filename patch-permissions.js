const fs = require('fs');

let code = fs.readFileSync('src/zNEP17.Protocol/zNEP17Protocol.cs', 'utf8');

code = code.replace(
    '[ContractPermission(Permission.Any, "verify")]',
    '[ContractPermission(Permission.Any, "verify")]\n[ContractPermission(Permission.Any, "verifyTreeUpdate")]'
);

fs.writeFileSync('src/zNEP17.Protocol/zNEP17Protocol.cs', code);
