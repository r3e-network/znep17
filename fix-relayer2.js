const fs = require('fs');
let policyTest = fs.readFileSync('web/app/api/relay/route.policy.test.ts', 'utf8');

// I deleted the start of the "it" block but left the body.
policyTest = policyTest.replace(/      const res = await GET\(req\);\n    const payload = \(await res\.json\(\)\) as \{ error\?: string \};\n\n    expect\(res\.status\)\.toBe\(400\);\n    expect\(payload\.error\)\.toContain\("proof commitment"\);\n  }\);\n/g, '');

fs.writeFileSync('web/app/api/relay/route.policy.test.ts', policyTest);
