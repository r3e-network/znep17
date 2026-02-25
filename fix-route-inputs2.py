p = 'web/app/api/relay/zk-encoding.ts'
with open(p, 'r') as f:
    content = f.read()

content = content.replace("const PUBLIC_INPUT_COUNT = 8;", "const PUBLIC_INPUT_COUNT = 7;")
content = content.replace("const GROTH16_PUBLIC_INPUTS_PACKED_BYTES = PUBLIC_INPUT_COUNT * SCALAR_BYTES;", "const GROTH16_PUBLIC_INPUTS_PACKED_BYTES = PUBLIC_INPUT_COUNT * SCALAR_BYTES;")

with open(p, 'w') as f:
    f.write(content)
