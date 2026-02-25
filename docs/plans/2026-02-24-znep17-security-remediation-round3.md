# zNEP-17 Security Remediation Round 3 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Eliminate protocol-critical binding flaws and harden contract/relayer/frontend/devsecops to production-grade security while preserving real Neo N3 testnet operability.

**Architecture:** The fix introduces cryptographic domain separation and note-binding across circuit, relayer, and vault contract. Withdraw now includes a commitment that is bound in proof and validated against on-chain note metadata `(asset, amount)`. Relayer/frontend public input schema is updated in lockstep, and runtime policy hardening removes ineffective public API-secret patterns while tightening transport/security controls.

**Tech Stack:** Neo N3 C# smart contracts, Circom + snarkjs, Next.js 16 (Vercel runtime), neon-js, xUnit, GitHub Actions.

### Task 1: Add failing contract tests for note binding

**Files:**
- Modify: `tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs`
- Modify: `tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs`

**Step 1: Write failing tests**
- Add tests showing withdraw must fail when commitment does not map to deposited `(asset, amount)` metadata.
- Add tests for mismatched amount and asset against the committed note.

**Step 2: Run tests to verify failure**
Run: `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj --filter "FullyQualifiedName~Znep17IntegrationTests|FullyQualifiedName~Znep17RealContractsIntegrationTests"`
Expected: FAIL due to missing commitment argument/metadata checks.

### Task 2: Implement contract-level note-binding and liveness hardening

**Files:**
- Modify: `src/zNEP17.Protocol/zNEP17Protocol.cs`
- Modify: `src/zNEP17.Protocol/PrivacyGuards.cs`
- Modify: `tests/zNEP17.Protocol.Tests/TestContracts/TestVerifier.cs`

**Step 1: Minimal implementation**
- Add commitment argument to withdraw and verifier boundary.
- Persist note metadata on deposit keyed by commitment leaf.
- Enforce metadata match `(asset, amount)` before payout.
- Keep fee=0 self-claim path (recipient witness) for relayer-liveness fallback.
- Add governance safety guard for relayer/verifier updates (controlled update path).

**Step 2: Re-run contract tests**
Run: `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj`
Expected: PASS.

### Task 3: Add failing relayer/frontend checks for new public input domain

**Files:**
- Modify: `web/app/api/relay/route.ts`
- Modify: `web/app/page.tsx`

**Step 1: Apply red phase through strict runtime validations**
- Enforce new 8-element public input schema: root, nullifierHash, recipient, relayer, amount, fee, asset, commitment.
- Reject old schema explicitly.

**Step 2: Verify runtime catches old payloads**
Run: `cd web && npm run lint && npx tsc --noEmit`
Expected: compile clean with updated schema usage.

### Task 4: Harden relayer auth, body parsing, and frontend secret handling

**Files:**
- Modify: `web/app/api/relay/route.ts`
- Modify: `web/app/page.tsx`
- Modify: `web/README.md`

**Step 1: Minimal hardening implementation**
- Remove browser-exposed API key dependency (`NEXT_PUBLIC_RELAYER_API_KEY`).
- Keep server-only auth option + strict origin policy.
- Add bounded body parsing and robust request validation.
- Reduce secret retention in frontend lifecycle.

**Step 2: Verify web quality gate**
Run:
- `cd web && npm run lint`
- `cd web && npx tsc --noEmit`
- `cd web && npm run build`
Expected: PASS.

### Task 5: DevSecOps hardening and docs

**Files:**
- Modify: `.gitignore`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `circuits/README.md`

**Step 1: Implement hardening**
- Ignore `.env*` and sensitive local files.
- Add dependency-audit gates to CI with actionable thresholds.
- Update interface docs for commitment-bound withdraw and 8-input proof schema.

**Step 2: Validate CI config syntax and local commands**
Run:
- `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj`
- `cd web && npm ci && npm run lint && npx tsc --noEmit && npm run build`
Expected: PASS.

### Task 6: End-to-end regeneration and real testnet verification

**Files:**
- Modify as generated: `tests/zNEP17.Protocol.Tests/TestingArtifacts/*`
- Execute: `scripts/regenerate-testing-artifacts.sh`
- Execute: `scripts/run-testnet-e2e.cjs`

**Step 1: Regenerate artifacts**
Run: `./scripts/regenerate-testing-artifacts.sh`
Expected: updated contract/verifier bindings.

**Step 2: Real testnet e2e**
Run:
- `export ZNEP17_TESTNET_WIF='<provided testnet WIF>'`
- `export ZNEP17_TESTNET_RPC='https://n3seed1.ngd.network:20332'`
- `npm run testnet:e2e`
Expected: all scenarios pass with new commitment-bound withdraw path.
