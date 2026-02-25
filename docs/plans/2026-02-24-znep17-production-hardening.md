# zNEP-17 Production Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Harden the zNEP-17 prototype so the deployed stack is safer, operationally correct, and explicit about prototype limitations.

**Architecture:** Tighten relayer startup/runtime policy checks, add durable guard support hooks for serverless deployments, enforce strict payload bounds at relayer + contract boundaries, and align frontend behavior with supported proof modes. Add missing governance/pause regression tests and update docs for secure deployment.

**Tech Stack:** Next.js App Router (Node runtime), TypeScript, Neon JS, C# Neo smart contract, xUnit, Vercel KV client.

### Task 1: Harden relayer configuration and mode safety

**Files:**
- Modify: `web/app/api/relay/route.ts`
- Test: `web` build/lint/typecheck

1. Add startup config validation helper and return structured `configured=false` errors when required env vars/policies are missing.
2. Enforce production-safe defaults:
- Require origin allowlist and API key in production.
- Require durable guard storage in production.
- Forbid `prototype` mode in production.
3. Expose config diagnostics via `GET /api/relay` (mode, guard-store mode, readiness flags).
4. Add explicit snark-readiness gating so snark withdrawals are rejected with clear errors when unsupported.

### Task 2: Add durable guard store support + fallback

**Files:**
- Modify: `web/app/api/relay/route.ts`
- Modify: `web/package.json`

1. Add `@vercel/kv` dependency.
2. Implement rate-limit + nullifier lock abstraction:
- Durable mode (Vercel KV) when configured.
- In-memory fallback for local development.
3. Convert guard operations to async and wire into POST handler.

### Task 3: Enforce payload bounds and stricter request validation

**Files:**
- Modify: `web/app/api/relay/route.ts`
- Modify: `src/zNEP17.Protocol/PrivacyGuards.cs`
- Modify: `src/zNEP17.Protocol/zNEP17Protocol.cs`
- Modify: `tests/zNEP17.Protocol.Tests/WithdrawBehaviorTests.cs`

1. Add upper limits for proof/publicInputs sizes in relayer and contract guard logic.
2. Require exact public input count where expected.
3. Add tests for oversize argument rejection.

### Task 4: Reduce contract storage growth risk

**Files:**
- Modify: `src/zNEP17.Protocol/PrivacyGuards.cs`
- Modify: `src/zNEP17.Protocol/zNEP17Protocol.cs`
- Modify: `tests/zNEP17.Protocol.Tests/Znep17RealContractsIntegrationTests.cs` (if needed)

1. Add bounded retention windows for roots and stored leaves.
2. Prune old entries on deposit.
3. Keep compatibility for read methods (`GetLeaf`, `IsKnownRoot`) within retention window.

### Task 5: Fix frontend relay-state correctness and mode UX

**Files:**
- Modify: `web/app/page.tsx`

1. Fix stale `relayLoading` by setting loading true for every refresh cycle.
2. Clear stale relay error on successful refresh.
3. Surface relayer mode/readiness and block unsupported snark flow with explicit message.

### Task 6: Add governance/pause coverage

**Files:**
- Create: `tests/zNEP17.Protocol.Tests/GovernanceBehaviorTests.cs`

1. Add tests for owner-only controls (`SetPaused`, `SetVerifier`).
2. Add tests for ownership transfer + acceptance witness requirements.
3. Add tests that pause blocks deposit and withdraw execution.

### Task 7: Harden testnet script defaults and docs

**Files:**
- Modify: `scripts/run-testnet-e2e.cjs`
- Modify: `web/README.md`
- Modify: `README.md`

1. Enforce secure RPC URL scheme for e2e runner (https/wss).
2. Update docs with required production env vars and policy behavior.

### Task 8: Verification

**Files:**
- N/A

1. Run: `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj`
2. Run: `npm run lint` in `web`
3. Run: `npx tsc --noEmit` in `web`
4. Run: `npm run build` in `web`
5. Run: `npm audit --omit=dev --audit-level=low` in `web` and capture remaining issues.
