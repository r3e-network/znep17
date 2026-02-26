# zNEP17 Production Audit Round 7 (2026-02-25)

## Scope

- Deep audit of Vercel + Supabase off-chain maintainer path.
- Verify security posture of `/api/maintainer`, Supabase admin client, and frontend maintainer controls.
- Implement and verify production hardening fixes.

## Findings and Fixes

1. **`/api/maintainer` was unauthenticated and callable from public UI** (High)
   - **Risk:** Any external caller could trigger expensive root-update flows and consume maintainer operational budget.
   - **Fixes:**
     - Added authenticated maintainer policy (`MAINTAINER_REQUIRE_AUTH`, `MAINTAINER_API_KEY`) with constant-time credential compare.
     - Added optional origin allowlist gate (`MAINTAINER_REQUIRE_ORIGIN_ALLOWLIST`, `MAINTAINER_ALLOWED_ORIGINS`).
     - Hid maintainer UI tools behind `NEXT_PUBLIC_ENABLE_MAINTAINER_TOOLS=false` by default.
   - **Files:** `web/app/api/maintainer/route.ts`, `web/app/page.tsx`, `web/README.md`

2. **Maintainer execution lacked concurrency lock / idempotent guarding** (High)
   - **Risk:** Concurrent root-update runs could submit conflicting transactions and increase stale-root publication probability.
   - **Fixes:**
     - Added single-run lock with memory mode for dev and durable Redis mode for production (`MAINTAINER_REQUIRE_DURABLE_LOCK` + `KV_REST_*`).
     - Added explicit `409` conflict response when lock is held.
   - **Files:** `web/app/api/maintainer/route.ts`

3. **Supabase client used placeholder fail-open defaults** (Medium)
   - **Risk:** Missing environment configuration was masked, causing non-deterministic runtime behavior and unsafe deployment posture.
   - **Fixes:**
     - Replaced placeholder defaults with fail-closed `getSupabaseAdminClient()` loader.
     - Added strict URL validation (`https://`) and required service-role key enforcement.
   - **Files:** `web/app/lib/supabase.ts`

4. **Maintainer leaf-cache integrity checks were insufficient** (Medium)
   - **Risk:** Incomplete or divergent Supabase cache could produce incorrect tree roots.
   - **Fixes:**
     - Added deterministic cache reconciliation (missing index detection + on-chain backfill + Supabase upsert).
     - Added prefix-root consistency check against on-chain current root before publishing a new root.
     - Added chain-state recheck before submit to reduce stale publication windows.
   - **Files:** `web/app/api/maintainer/route.ts`

5. **No automated tests for maintainer security policy and failure modes** (Medium)
   - **Fixes:**
     - Added dedicated maintainer route tests for production fail-closed config, auth rejection, sync-limit rejection, stale-chain conflict, and success path.
     - Included maintainer tests in standard policy test run.
   - **Files:** `web/app/api/maintainer/route.test.ts`, `web/package.json`

## Verification Evidence

1. Web policy/security tests
   - `cd web && npm run test:policy` -> pass (`26/26`)

2. Web quality gates
   - `cd web && npm run lint` -> pass
   - `cd web && npm run build` -> pass (Next.js 16 webpack, dynamic API routes `relay` + `maintainer`)

3. Contract/security regression checks
   - `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj` -> pass (`46/46`)
   - `npm run test:security` -> pass

## Residual Risk Note

- Contract method `updateMerkleRoot` does not currently bind `newRoot` to an explicit expected leaf-count argument. Off-chain rechecks reduce risk, but a strict on-chain leaf-count binding would further harden against mid-flight deposit races.
