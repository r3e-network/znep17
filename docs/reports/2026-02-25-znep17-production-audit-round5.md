# zNEP17 Production Audit Round 5 (2026-02-25)

## Scope

- Eliminate all remaining low-severity dependency findings in root/web/circuits.
- Preserve production behavior for relayer, verifier binding, frontend, and testnet E2E flows.
- Re-verify Vercel-compatible Next.js production build and real on-chain execution.

## Findings and Remediations

1. **Unused vulnerable dependency chain remained in root (`circomlibjs -> ethers v5`)** (Low)
   - **Risk:** Unused dependency still expands attack surface and fails strict security policy.
   - **Fix:** Removed `circomlibjs` from root dependencies (project already uses `poseidon-lite` and native proof assets).
   - **Files:** `package.json`, `package-lock.json`

2. **`elliptic` advisory (`GHSA-848j-6mx2-7j84`) remained via `@cityofzion/neon-core`** (Low)
   - **Risk:** Dependency audit remained non-zero in strict mode.
   - **Fix:** Vendored patched `elliptic` package as internal `6.6.2`, with nonce truncation hardening in ECDSA signing path:
     - preserve full DRBG bit-length when truncating `k` to curve order.
   - **Files:** `vendor/elliptic/lib/elliptic/ec/index.js`, `vendor/elliptic/package.json`, `package.json`, `web/package.json`, lockfiles

3. **No regression guard for patched nonce truncation path** (Low)
   - **Risk:** Future dependency drift could silently reintroduce vulnerable behavior.
   - **Fix:** Added deterministic regression test script targeting the exact truncation semantics.
   - **Files:** `scripts/security-elliptic-truncation-regression.cjs`, `package.json`

## Verification Evidence

1. Security/dependency status
   - `npm audit --json` (root) -> `0` vulnerabilities
   - `cd web && npm audit --json` -> `0` vulnerabilities
   - `cd circuits && npm audit --json` -> `0` vulnerabilities
   - Active runtime `elliptic` version in root/web neon-core path -> `6.6.2`

2. Regression and quality gates
   - `npm run test:security` -> pass
   - `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj -v minimal` -> pass (`46/46`)
   - `cd web && npm run test:policy` -> pass (`19/19`)
   - `cd web && npm run lint` -> pass
   - `cd web && npm run build` -> pass (Next.js 16 production build, webpack)

3. Real Neo N3 testnet validation (post-fix)
   - Command:
     - `ZNEP17_TESTNET_WIF=*** npm run testnet:e2e`
   - Result: success
   - Latest artifact:
     - `artifacts/testnet-e2e-2026-02-25T00-20-52_403Z.json`
   - Coverage:
     - `8` scenarios
     - `14` assertions
   - Latest deployed hashes:
     - Main vault: `9fac5cbe6e3923e7f13c5cb311d997c6ffb58160`
     - No-verifier vault: `0c8a44cd2f26d8c3f2dad577397b26135efeb683`
     - Token: `8676e07fbc30f69c5172447a18ccaf7fab501bc4`
     - Verifier: `d63b823768206654e60461bdebd02b97ced85060`

## Outcome

- Strict requirement satisfied: all known dependency findings removed, including low-severity.
- Production behavior remains intact with fresh local + on-chain verification.
