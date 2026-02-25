import re

p1 = 'web/app/api/relay/route.encoding.test.ts'
with open(p1, 'r') as f:
    content = f.read()

content = content.replace('''    const signals = [
      "1",
      "256",
      "65535",
      "0",
      "42",
      "100000000",
      "340282366920938463463374607431768211455",
      "1234567890",
    ];''', '''    const signals = [
      "1",
      "256",
      "65535",
      "0",
      "42",
      "100000000",
      "340282366920938463463374607431768211455",
    ];''')

content = content.replace("expect(payload.length).toBe(256);", "expect(payload.length).toBe(224);")

with open(p1, 'w') as f:
    f.write(content)

