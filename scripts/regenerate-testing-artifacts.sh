#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="$ROOT_DIR/tests/zNEP17.Protocol.Tests/TestingArtifacts"

dotnet nccs "$ROOT_DIR/src/zNEP17.Protocol/zNEP17.Protocol.csproj" \
  --output "$OUT_DIR" \
  --generate-artifacts source \
  --optimize Basic

dotnet nccs "$ROOT_DIR/src/zNEP17.Verifier/zNEP17.Verifier.csproj" \
  --output "$OUT_DIR" \
  --generate-artifacts source \
  --optimize Basic

dotnet nccs "$ROOT_DIR/tests/zNEP17.Protocol.Tests/TestContracts/TestNep17Token.cs" \
  --output "$OUT_DIR" \
  --generate-artifacts source \
  --optimize Basic

dotnet nccs "$ROOT_DIR/tests/zNEP17.Protocol.Tests/TestContracts/TestVerifier.cs" \
  --output "$OUT_DIR" \
  --generate-artifacts source \
  --optimize Basic
