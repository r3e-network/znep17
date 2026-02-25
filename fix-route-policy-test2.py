import re

p1 = 'web/app/api/relay/route.encoding.test.ts'
with open(p1, 'r') as f:
    content = f.read()

content = content.replace('["1", "2", "3", "4", "5", "6", "7", "8"]', '["1", "2", "3", "4", "5", "6", "7"]')
with open(p1, 'w') as f:
    f.write(content)

p2 = 'web/app/api/relay/route.policy.test.ts'
with open(p2, 'r') as f:
    content = f.read()

content = content.replace('publicInputs: ["0", "0", "0", "0", "0", "0", "0", "0"]', 'publicInputs: ["0", "0", "0", "0", "0", "0", "0"]')
with open(p2, 'w') as f:
    f.write(content)

