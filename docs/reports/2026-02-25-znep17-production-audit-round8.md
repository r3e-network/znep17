# zNEP17 Production Audit Round 8 (2026-02-25)

## Scope

- Deep security and production-readiness review after protocol/verifier ABI alignment.
- End-to-end consistency check across contracts, relayer API, frontend proving artifacts, and testnet execution.
- Remediation of all identified issues (including low severity test-quality gaps).

## Findings and Fixes

1. **Relayer/frontend still enforced 7 public inputs while on-chain verifier required 8** (High)
   - **Risk:** Browser/relayer proofs could be rejected or incorrectly encoded against live verifier ABI, breaking withdrawals in production.
   - **Fixes:**
     - Updated relayer input policy to require 8 public inputs.
     - Updated packed public-input encoder to 256 bytes (8 x 32).
     - Added POST precheck for commitment existence (`getCommitmentIndex`) before spending relayer gas.
     - Updated relay tests to match 8-input schema and added explicit invalid-length regression case.
   - **Files:** `web/app/api/relay/route.ts`, `web/app/api/relay/zk-encoding.ts`, `web/app/api/relay/route.encoding.test.ts`, `web/app/api/relay/route.policy.test.ts`

2. **Web ZK artifacts drifted from canonical circuit artifacts** (High)
   - **Risk:** Frontend proof generation/verification used stale wasm/zkey/vkey (7-input) against upgraded on-chain verifier (8-input), creating production incompatibility.
   - **Fixes:**
     - Synced `web/public/zk/*` from `circuits/bls/*`.
     - Updated `verify-zk-artifacts` pinned hashes.
     - Added explicit source-sync check so `web/public/zk/*` must match canonical circuit artifacts.
   - **Files:** `web/public/zk/withdraw.wasm`, `web/public/zk/withdraw_final.zkey`, `web/public/zk/verification_key.json`, `web/scripts/verify-zk-artifacts.cjs`

3. **Testnet E2E harness did not enforce expected fault reason assertions** (Medium)
   - **Risk:** Negative scenarios could silently pass despite wrong fault semantics, weakening security regression confidence.
   - **Fixes:**
     - Hardened E2E assertion logic to fail immediately when expected exception text is not present.
     - Corrected amount-binding negative-case expected fault text to the contract’s real guard (`zk proof invalid`).
   - **Files:** `scripts/run-testnet-e2e.cjs`

4. **Maintainer production allowlist did not reject insecure origins** (Low)
   - **Risk:** Misconfigured HTTP origin rules in production could weaken endpoint exposure controls.
   - **Fixes:**
     - Added production validation requiring HTTPS-only maintainer allowlist origins.
     - Added maintainer policy regression test for insecure origin rejection.
   - **Files:** `web/app/api/maintainer/route.ts`, `web/app/api/maintainer/route.test.ts`

5. **Test suite contained placeholder/empty tests** (Low)
   - **Risk:** False confidence in coverage and reduced audit trustworthiness.
   - **Fixes:**
     - Replaced placeholder tests with concrete withdraw/deposit/governance/verifier binding assertions.
   - **Files:** `tests/zNEP17.Protocol.Tests/WithdrawBehaviorTests.cs`, `tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs`, `tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs`, `tests/zNEP17.Protocol.Tests/VerifierContractBehaviorTests.cs`

## Verification Evidence

1. Contract test suite
   - `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj` -> pass (`46/46`)

2. Web policy and quality gates
   - `cd web && npm run test:policy` -> pass (`28/28`)
   - `cd web && npm run lint` -> pass
   - `cd web && npm run build` -> pass (`npm run verify:zk` included)

3. Security regression
   - `npm run test:security` -> pass

4. Real Neo N3 testnet E2E
   - `npm run testnet:e2e` -> pass
   - Evidence: `artifacts/testnet-e2e-2026-02-25T05-59-56_437Z.json`

## Residual Risk Note

- Relayer and maintainer both rely on runtime environment hardening (`*_REQUIRE_*` and secret management). Deployment pipelines must keep production env policy flags and secrets immutable and audited.
