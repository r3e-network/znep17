import re

filepath = 'src/zNEP17.Protocol/PrivacyGuards.cs'
with open(filepath, 'r') as f:
    content = f.read()

content = content.replace(
    'public const uint SecurityCouncilUpdateDelaySeconds = 172800; // 48 hours',
    'public const uint SecurityCouncilUpdateDelaySeconds = 172800; // 48 hours\n    public const uint RootUpdateDelaySeconds = 43200; // 12 hours'
)

with open(filepath, 'w') as f:
    f.write(content)

