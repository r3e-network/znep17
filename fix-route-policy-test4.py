p1 = 'web/app/api/relay/zk-encoding.ts'
with open(p1, 'r') as f:
    content = f.read()

content = content.replace('export const GROTH16_PUBLIC_INPUTS_PACKED_BYTES = 256;', 'export const GROTH16_PUBLIC_INPUTS_PACKED_BYTES = 224;')

with open(p1, 'w') as f:
    f.write(content)
