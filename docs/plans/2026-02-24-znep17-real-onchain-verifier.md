# zNEP-17 Real BLS12-381 On-Chain Verifier Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the mock verifier path with a production Groth16 verifier on Neo N3 using native BLS12-381 syscalls, and make relayer/frontend/e2e flows emit and consume production proof encodings.

**Architecture:** Add a dedicated verifier contract with a hardcoded BLS12-381 verification key and strict packed proof/public-input decoding; keep vault-verifier separation while tightening payload guards. Update relayer and browser flow to encode proof/public inputs into fixed binary formats expected by verifier. Promote BLS artifacts across circuits/web and re-run contract/web/testnet validation.

**Tech Stack:** Neo N3 smart contracts (C#), Neo CryptoLib BLS12-381 interop, snarkjs Groth16 (bls12381), Next.js relayer/frontend, neon-js testnet e2e scripts.

### Task 1: BLS Artifacts + VK Compression

**Files:**
- Modify: `circuits/bls/verification_key.json`
- Create: `circuits/bls/verification_key_compressed.json`

1. Validate that `withdraw.r1cs` is built on `bls12381` and `verification_key.json` has `curve=bls12381`.
2. Convert VK points to Neo-compatible compressed point bytes (G1=48, G2=96) and normalize compression flag.
3. Persist compressed VK metadata used by contract constant generation.

### Task 2: Real Verifier Contract

**Files:**
- Create: `src/zNEP17.Verifier/zNEP17.Verifier.csproj`
- Create: `src/zNEP17.Verifier/zNEP17Groth16Verifier.cs`
- Create: `src/zNEP17.Verifier/VerificationKey.Bls12381.cs`

1. Add `verify(asset, proof, publicInputs, merkleRoot, nullifierHash, commitment, recipient, relayer, amount, fee)` method.
2. Enforce exact payload sizes: proof=192 bytes, publicInputs=256 bytes.
3. Validate public input binding against method args (domain binding and anti-front-running).
4. Perform Groth16 pairing equation with `CryptoLib.Bls12381Deserialize/Add/Mul/Pairing/Equal`.

### Task 3: Vault Guard Tightening

**Files:**
- Modify: `src/zNEP17.Protocol/PrivacyGuards.cs`

1. Replace max-only proof/public-input checks with exact production lengths.
2. Keep backward-compatible method signatures while fail-closing malformed encodings.

### Task 4: Relayer + Frontend Encoding

**Files:**
- Modify: `web/app/api/relay/route.ts`
- Modify: `web/app/page.tsx`
- Modify: `web/scripts/verify-zk-artifacts.cjs`
- Modify: `web/public/zk/*` (BLS artifacts)

1. Encode proof JSON as packed compressed bytes `A|B|C`.
2. Encode 8 public signals as 8x32-byte little-endian payload.
3. Keep `snarkjs.groth16.verify` on server before tx submission.
4. Ensure Next/Vercel build/runtime compatibility for encoding helpers.

### Task 5: Test Harness + E2E Wiring

**Files:**
- Modify: `scripts/regenerate-testing-artifacts.sh`
- Modify: `tests/zNEP17.Protocol.Tests/*`
- Modify: `scripts/run-testnet-e2e.cjs`

1. Compile testing artifacts for real verifier contract.
2. Add/adjust tests for verifier payload binding and strict length guards.
3. Replace e2e mock verifier deployment with real verifier contract deployment and proof path.

### Task 6: Verification

**Files:**
- Modify: `docs/reports/` (new run report)

1. Run `dotnet test` for contract/test suites.
2. Run web checks: policy tests, lint/typecheck, `npm run build`.
3. Run testnet e2e with configured WIF and record tx hashes/results.
4. Publish final production-readiness deltas and residual risks.
