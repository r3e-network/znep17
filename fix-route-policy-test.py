import re

p1 = 'web/app/api/relay/route.encoding.test.ts'
with open(p1, 'r') as f:
    content = f.read()
# Replace the 8 array values with 7
content = re.sub(r'publicInputs: \["1", "2", "3", "4", "5", "6", "7", "8"\]', 'publicInputs: ["1", "2", "3", "4", "5", "6", "7"]', content)
content = content.replace('8 x 32-byte', '7 x 32-byte')
with open(p1, 'w') as f:
    f.write(content)

p2 = 'web/app/api/relay/route.policy.test.ts'
with open(p2, 'r') as f:
    content = f.read()
content = content.replace('publicInputs: Array(8).fill("1"),', 'publicInputs: Array(7).fill("1"),')
with open(p2, 'w') as f:
    f.write(content)

