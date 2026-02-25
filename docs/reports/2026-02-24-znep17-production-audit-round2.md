# zNEP-17 Production Audit (Round 2)

Date: 2026-02-24

## Scope

- Smart contract runtime safety and withdrawal spendability guarantees.
- Relayer backend abuse resistance and production policy behavior.
- Frontend correctness for SNARK flow, deployment compatibility, and relay integration.
- Real Neo N3 testnet end-to-end validation.

## Findings Resolved

1. **High: historical roots became unspendable after retention pruning**
   - Issue: deleting old roots from `RootMap` could make valid historical deposits non-withdrawable.
   - Fix:
     - Keep `RootMap` membership persistent.
     - Prune only `RootHistoryMap` index records.
   - Files:
     - `src/zNEP17.Protocol/zNEP17Protocol.cs`
     - `src/zNEP17.Protocol/PrivacyGuards.cs`
     - `tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs`

2. **Medium: in-memory rate-limit map growth / spoofed-IP pressure**
   - Issue: map entries were never evicted; unbounded key growth could be abused.
   - Fix:
     - Added periodic expiration cleanup.
     - Added hard cap (`RATE_LIMIT_MAX_TRACKED_KEYS=4096`) with oldest-key eviction.
     - Added IP normalization and stricter extraction path.
   - File:
     - `web/app/api/relay/route.ts`

3. **Medium: browser client could not operate when relayer auth was enabled**
   - Issue: frontend did not send auth header, causing 401 when `RELAYER_REQUIRE_AUTH=true`.
   - Fix:
     - Added `NEXT_PUBLIC_RELAYER_API_KEY` support in frontend request headers.
     - Added relay config flag `requiresApiKey` and frontend precheck with clear error.
   - Files:
     - `web/app/page.tsx`
     - `web/app/api/relay/route.ts`
     - `web/README.md`

4. **Medium: hard-coded testnet explorer URL**
   - Issue: tx link always pointed to testnet explorer regardless of active network.
   - Fix:
     - Added network-magic based explorer mapping + env override.
   - File:
     - `web/app/page.tsx`

5. **Medium: SNARK artifacts loaded from root-only paths**
   - Issue: absolute `/zk/...` broke under non-root base-path deployments.
   - Fix:
     - Added base-path aware artifact resolution via `NEXT_PUBLIC_BASE_PATH`.
   - File:
     - `web/app/page.tsx`

## Additional Consistency Updates

- Removed runtime/product metadata wording that labeled implementation as “prototype”.
  - `src/zNEP17.Protocol/zNEP17Protocol.cs`
  - `web/app/layout.tsx`
  - `README.md`

## Verification Evidence

### Contract and unit/integration tests

- Command:
  - `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj -v minimal`
- Result:
  - Passed: 22/22

### Frontend static checks

- Commands:
  - `cd web && npm run lint`
  - `cd web && npx tsc --noEmit`
  - `cd web && npm run build`
- Result:
  - All passed.

### Dependency audit (production deps)

- Command:
  - `cd web && npm audit --omit=dev --json`
- Result:
  - `0` moderate/high/critical vulnerabilities.
  - `18` low-severity findings (transitive, mainly `elliptic`/`ethers` lineage via `neon-js` and `circomlibjs` trees), with semver-major upgrade paths.

### Real testnet e2e

- Command:
  - `ZNEP17_TESTNET_RPC='https://n3seed1.ngd.network:20332' ZNEP17_TESTNET_WIF='<provided>' npm run testnet:e2e`
- Result:
  - Completed successfully.
- Artifact:
  - `artifacts/testnet-e2e-2026-02-24T02-51-35_809Z.json`
- Contracts in run:
  - Main vault: `2cfea527a4d7922a51f2ce228d35021b1a0e44ad`
  - No-verifier vault: `e8b6882c7844c7a8c40075fd03bf9a4eecac61f1`
  - Token: `6ff9eaa9e1ae99483e2ac742cab2f955c02888a4`
  - Verifier: `76e1f9fcd6b03d738758c3a43fadf358d013c737`

### Browser smoke (production server)

- Built and ran production frontend (`next start`) and validated page render + relay-config error-state rendering through `agent-browser`.

## Required Vercel Environment Variables

Relayer/runtime:

- `RPC_URL`
- `VAULT_HASH`
- `RELAYER_WIF`
- `ALLOWED_TOKEN_HASHES`
- `RELAYER_ALLOWED_ORIGINS`
- `RELAYER_API_KEY`
- `RELAYER_REQUIRE_AUTH`
- `RELAYER_REQUIRE_ORIGIN_ALLOWLIST`
- `RELAYER_REQUIRE_DURABLE_GUARDS`
- `RELAYER_ONCHAIN_PROOF_SENTINEL`
- `KV_REST_API_URL` (if durable guards enabled)
- `KV_REST_API_TOKEN` (if durable guards enabled)

Frontend:

- `NEXT_PUBLIC_RELAYER_API_KEY` (required when `RELAYER_REQUIRE_AUTH=true`)
- `NEXT_PUBLIC_BASE_PATH` (optional, for non-root deploy path)
- `NEXT_PUBLIC_EXPLORER_TX_BASE_URL` (optional override)

## Residual Risk Notes

- If `RELAYER_ONCHAIN_PROOF_SENTINEL=true`, on-chain verifier payload is compatibility mode for current test verifier contract; off-chain SNARK verification remains enforced. For full production verifier integration, set this to `false` with real verifier contract support.
