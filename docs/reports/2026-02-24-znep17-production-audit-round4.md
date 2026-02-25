# zNEP17 Production Audit Round 4 (2026-02-24)

## Scope

- Relayer policy and runtime hardening (`web/app/api/relay/route.ts`)
- Frontend safety and operator error resistance (`web/app/page.tsx`)
- Policy test coverage and deployment docs (`web/app/api/relay/route.policy.test.ts`, `web/README.md`, `README.md`)
- Real Neo N3 testnet regression validation

## Findings and Remediations

1. **Verifier identity was not cryptographically pinned in relayer policy** (High)
   - **Risk:** If vault governance points to a malicious verifier that rejects the sentinel probe but still accepts crafted invalid proofs, relayer-side trust can be bypassed.
   - **Fix:** Added `RELAYER_EXPECTED_VERIFIER_HASH` pinning and enforced it when strong verifier mode is enabled. Production now requires this setting.
   - **Files:** `web/app/api/relay/route.ts`, `web/app/api/relay/route.policy.test.ts`, `web/README.md`, `README.md`

2. **Merkle leaf safety cap was only applied on cold bootstrap** (Medium)
   - **Risk:** Warm cache instances could grow beyond configured cap, increasing memory/CPU pressure and weakening DoS controls over time.
   - **Fix:** Enforced `RELAYER_MERKLE_MAX_BOOTSTRAP_LEAVES` as a hard limit for all proof-tree builds/updates.
   - **Files:** `web/app/api/relay/route.ts`

3. **Nullifier lock release path could throw and degrade API availability** (Medium)
   - **Risk:** Durable store release failures could turn otherwise handled request paths into internal failures.
   - **Fix:** Added `safeReleaseNullifierLock` and centralized unlock flow to avoid release exceptions breaking request handling.
   - **Files:** `web/app/api/relay/route.ts`

4. **Frontend allowed arbitrary vault hash edits by default** (Medium)
   - **Risk:** Users can accidentally deposit to a different contract than the relayer target, leading to irreversible fund misrouting.
   - **Fix:** Vault hash is now locked to relayer-provided value by default. Custom override requires explicit `NEXT_PUBLIC_ALLOW_CUSTOM_VAULT_HASH=true`.
   - **Files:** `web/app/page.tsx`, `web/README.md`

5. **Relayer startup config validation was incomplete** (Low)
   - **Risk:** Invalid `RELAYER_WIF`/`VAULT_HASH` could fail only at runtime paths.
   - **Fix:** Added early validation and explicit configuration issue surfacing.
   - **Files:** `web/app/api/relay/route.ts`

## Verification Evidence

1. Contract suite
   - `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj`
   - Result: `39/39` passed

2. Web quality gates
   - `cd web && npm run test:policy` -> pass (`13/13`)
   - `cd web && npm run lint` -> pass
   - `cd web && npx tsc --noEmit` -> pass
   - `cd web && npm run build` -> pass

3. Security/dependency checks
   - `npm audit --audit-level=high` -> no high/critical (4 low, `neon-js` transitive)
   - `cd web && npm audit --audit-level=high` -> no high/critical (4 low, `neon-js` transitive)
   - `dotnet list ... --vulnerable --include-transitive` (contract + tests) -> no vulnerable packages

4. Real testnet validation
   - Command:
     - `ZNEP17_TESTNET_RPC=https://n3seed2.ngd.network:20332 ZNEP17_TESTNET_WIF=... npm run testnet:e2e`
   - Result: success
   - Latest artifact: `artifacts/testnet-e2e-2026-02-24T14-16-51_141Z.json`

## Residual Risk / Blocker

- **Critical architecture blocker remains:** repository still does not include a real production Groth16/PLONK verifier contract implementation; tests use `TestVerifier` behavior scaffolding.
- Current mitigations (`RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER` + `RELAYER_EXPECTED_VERIFIER_HASH`) reduce operational risk but do not replace a formally verified on-chain zk verifier.
