# zNEP17 Production Audit Round 6 (2026-02-25)

## Scope

- Final production-readiness review for contract + relayer + frontend stack.
- Validate that latest regenerated contract artifacts match active source.
- Confirm strict security posture (including low-severity dependency findings = zero).

## Findings and Fixes

1. **POST relay request parsing returned `500` for malformed client fields** (Medium)
   - **Risk:** Client input errors (e.g., malformed `tokenHash`, overflow `amount`, invalid `publicInputs`) were treated as server errors, reducing operability and making API behavior non-professional.
   - **Fix:** Added strict request-parse validation block in `POST /api/relay` and return `400` for malformed user input.
   - **Files:** `web/app/api/relay/route.ts`

2. **Replay nullifier lock was acquired before all deterministic request-shape checks** (Low)
   - **Risk:** Invalid requests could consume lock budget briefly before failing early.
   - **Fix:** Moved lock acquisition after deterministic request normalization/public-input consistency checks and before on-chain prechecks.
   - **Files:** `web/app/api/relay/route.ts`

3. **No regression tests for new POST validation behavior** (Low)
   - **Fix:** Added policy tests to assert `400` on invalid `tokenHash` and uint256-overflow `amount`.
   - **Files:** `web/app/api/relay/route.policy.test.ts`

## Verification Evidence

1. Artifact/source consistency
   - `./scripts/regenerate-testing-artifacts.sh` -> success (all NEF/manifest/artifacts regenerated from current source).

2. Contract + web checks
   - `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj -v minimal` -> pass (`46/46`)
   - `cd web && npm run test:policy` -> pass (`21/21`)
   - `cd web && npm run lint` -> pass
   - `cd web && npm run build` -> pass (Next.js 16 webpack, production build)

3. Security checks
   - `npm run test:security` -> pass
   - `npm audit --json` (root/web/circuits) -> `0` vulnerabilities in all trees

4. Real Neo N3 testnet e2e (latest)
   - Command: `ZNEP17_TESTNET_WIF=*** npm run testnet:e2e`
   - Artifact: `artifacts/testnet-e2e-2026-02-25T00-48-11_078Z.json`
   - Result: `success=true`, `8 scenarios`, `14 assertions`
   - Deployed hashes:
     - Main vault: `7e078bcc78094268f172a4e82e65694bede5a048`
     - No-verifier vault: `b6487a969bd4303aa050a1d5e2aee6aa8d2d4534`
     - Token: `2a0010799d828155cf522f47c38e4e9d797a9697`
     - Verifier: `d3b432b5e3adae1f6e30249ee8c701eccbd1d4ab`

## Outcome

- Current branch is in production-grade state for the implemented scope:
  - real on-chain verifier path,
  - strict relayer policy enforcement,
  - stable frontend build on Vercel-compatible Next.js stack,
  - zero known npm vulnerabilities (including low severity).
