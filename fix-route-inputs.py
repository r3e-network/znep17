p = 'web/app/api/relay/route.ts'
with open(p, 'r') as f:
    content = f.read()

# I need to fix MAX_PUBLIC_INPUT_COUNT = 7 because I removed commitment
content = content.replace("const MAX_PUBLIC_INPUT_COUNT = 8;", "const MAX_PUBLIC_INPUT_COUNT = 7;")

with open(p, 'w') as f:
    f.write(content)
