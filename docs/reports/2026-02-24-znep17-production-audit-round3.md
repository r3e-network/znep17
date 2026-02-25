# zNEP17 Production Audit Round 3 (2026-02-24)

## Scope

- Contract hardening completion review (`src/zNEP17.Protocol/zNEP17Protocol.cs`)
- Relayer API abuse-resistance review (`web/app/api/relay/route.ts`)
- Frontend/relayer cryptographic dependency hardening (`web/app/page.tsx`, `web/app/api/relay/route.ts`, `web/package.json`)
- End-to-end verification on Neo N3 testnet

## Security Fixes Applied

1. **Emergency withdraw authorization binding**
   - Each commitment is now bound to the original depositor on deposit.
   - Emergency withdraw requires witness from that depositor.
   - Prevents unauthorized drains by third parties who know only commitment values.

2. **Security council rotation dual-control enforcement**
   - `scheduleSecurityCouncilUpdate`, `applySecurityCouncilUpdate`, and `cancelSecurityCouncilUpdate` now require both owner and active council witnesses.
   - Brings council rotation in line with dual-control governance posture already used for verifier/relayer updates.

3. **Relay proof endpoint anti-abuse hardening**
   - `GET /api/relay?proof=` now enforces origin checks and optional API key auth before expensive Merkle reconstruction.
   - Added stricter proof-specific rate-limiting and malformed-input early rejection.

4. **Poseidon dependency-surface reduction**
   - Replaced `circomlibjs` usage with `poseidon-lite` (compatibility-verified vectors and random-case checks).
   - Reduced transitive audit footprint in `web/` from `18 low` to `4 low`.

## Added/Updated Tests

- `tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs`
  - `EmergencyWithdraw_EnforcesDelay_DepositorWitness_AndReplayProtection`
  - `EmergencyWithdraw_RejectsCommitmentWithDifferentAsset`
  - `SecurityCouncilRotation_RequiresOwnerAndCouncilWitness`
- `tests/zNEP17.Protocol.Tests/Znep17IntegrationTests.cs`
  - `Withdraw_Rejects_WhenRootPredatesCommitment_ThenSucceedsAfterRootRefresh`
- `web/app/api/relay/route.policy.test.ts`
  - proof-GET origin/auth/input-hardening checks
- `web/app/api/relay/poseidon.test.ts`
  - deterministic Poseidon compatibility vectors

## Verification Evidence

1. `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj`
   - Passed: `37/37`

2. Frontend quality/build checks
   - `cd web && npm run lint` -> pass
   - `cd web && npx tsc --noEmit` -> pass
   - `cd web && npm run test:policy` -> pass (`11/11`)
   - `cd web && npm run build` -> pass

3. Dependency audit state
   - `cd web && npm audit --audit-level=high` -> no high/critical (4 low)
   - `npm audit --audit-level=high` -> no high/critical (4 low)
   - `dotnet list ... --vulnerable --include-transitive` -> no vulnerable packages

4. Testnet real-world validation
   - `ZNEP17_TESTNET_WIF=... node scripts/run-testnet-e2e.cjs` completed successfully.
   - Latest artifact: `artifacts/testnet-e2e-2026-02-24T12-36-15_442Z.json`

## Residual Risk

- Remaining `low` npm findings are from the `@cityofzion/neon-js` transitive `elliptic` lineage.
- Available automatic remediation path is semver-major/breaking (`npm audit fix --force`).
- Current recommendation: treat as accepted low risk with explicit tracking; evaluate upstream Neon SDK roadmap before major migration.
