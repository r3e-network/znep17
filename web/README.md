# zNEP-17 Privacy Vault - Web Frontend

This Next.js application provides the zNEP-17 user interface and a SNARK-verifying relayer endpoint for Neo N3.

## Features

1. **SNARK-only flow**: Browser-side Groth16 proof generation (`snarkjs` + Poseidon hashing via `poseidon-lite` + WASM).
2. **Relayer preflight checks**: strict request validation, bounded payload sizes, public-input binding checks, root/nullifier on-chain prechecks.
3. **Replay/abuse controls**: rate limiting + nullifier locks (in-memory for local dev, durable Redis in production).
4. **Server-bound withdrawal execution**: relayer signs withdraw tx; contract enforces configured relayer witness.
5. **Commitment-bound proofs**: public input schema binds `asset` + `commitment` to prevent cross-asset and amount-domain abuse.
6. **ZK artifact integrity guard**: `npm run verify:zk` pins SHA-256 checksums and enforces sync with canonical `circuits/bls/*` artifacts.
7. **Hardened tree update endpoint**: authenticated + lock-guarded, proof-backed Merkle root publication with Supabase cache reconciliation.

## Setup

```bash
npm install

cat > .env.local <<'ENV'
RELAYER_WIF=YourFundedRelayerWIF
RELAYER_API_KEY=strong-random-secret
CRON_SECRET=strong-random-secret
KV_REST_API_URL=https://example.upstash.io
KV_REST_API_TOKEN=replace-with-upstash-rest-token
SUPABASE_SERVICE_ROLE_KEY=replace-with-supabase-service-role-key
# Optional secret overrides (not required):
# MAINTAINER_WIF=MaintainerWifWithGas
# MAINTAINER_API_KEY=another-strong-random-secret
ENV

npm run dev
# run separately in another terminal for async prover-worker mode
npm run maintainer:worker
```

## API

- `GET /api/relay`
  - returns `configured`, `relayerAddress`, `vaultHash`, `currentRoot`, `networkMagic`, `proofMode`, `guardStoreMode`
- `POST /api/relay`
  - expects SNARK proof payload, validates proof off-chain, submits `withdraw`
- `POST /api/maintainer`
  - when `MAINTAINER_ASYNC_QUEUE=true` (default outside tests): enqueues an update job and returns `202` immediately
  - with `x-maintainer-worker-execute: 1`: runs one or more update steps (worker path), syncs missing leaves from chain/Supabase cache, builds Groth16 tree-update proofs, and submits `updateMerkleRoot(proof, publicInputs, newRoot)`
  - worker script: `npm run maintainer:worker` polls Upstash queue and executes maintainer runs outside serverless timeout limits

## Production Requirements

1. Configure secrets:
   - `RELAYER_WIF`
   - `RELAYER_API_KEY`
   - `CRON_SECRET` (same value as `RELAYER_API_KEY`)
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Configure durable Redis:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
3. Run the maintainer worker as a separate long-running process:
   - `npm run maintainer:worker`
   - optional tuning:
     - `MAINTAINER_WORKER_POLL_MS`
     - `MAINTAINER_WORKER_MAX_BATCH_STEPS`
     - `MAINTAINER_WORKER_REQUEST_URL`
4. Non-secret chain/policy values are hardcoded in source for the znep17.app testnet deployment.
5. Configure the vault contract with the relayer address via `setRelayer`.
6. Do not expose maintainer/relayer API keys to browser clients; invoke `/api/maintainer` from cron/server jobs.

## Vercel

The relayer and maintainer routes run in `runtime=nodejs` as dynamic API routes (`app/api/relay`, `app/api/maintainer`). Standard `next build --webpack` is used.

### Required Project Settings

1. Set **Root Directory** to `web`.
2. Keep **Framework Preset** as `Next.js`.
3. Do not set a custom **Output Directory**.
4. Keep install/build commands aligned with `web/vercel.json`:
   - `npm ci`
   - `npm run build`
5. Vercel Cron can still call `/api/maintainer`, but it now enqueues jobs (fast) instead of proving inline.
6. The relayer auto-kicks `/api/maintainer` (throttled) when a proof is pending finalization, which adds queue jobs for the worker.
7. Heavy tree-update proving must run in the separate worker process (not in Vercel request execution).

### Production Env Checklist (Vercel)

1. Use [`web/env.vercel.production.example`](./env.vercel.production.example) as the source template for all Production env vars in Vercel.
2. Populate secrets in Vercel Project Settings -> Environment Variables (Production).
3. Pull the configured Production env set locally:
   - `vercel env pull .env.vercel.production`
4. Run the production validator:
   - `npm run validate:prod-env -- --env-file .env.vercel.production`
5. The validator must report all required checks as `PASS` before go-live.

### 404 Troubleshooting (`404: NOT_FOUND`)

If Vercel shows a platform 404 (with `Code: NOT_FOUND`) at `/`, the issue is usually project wiring, not app routing.

1. Redeploy after confirming the settings above.
2. Verify deployment routes from build logs contain:
   - `Route (app)` and `○ /`
3. Validate the deployment URL directly (`https://<deployment-id>.vercel.app/`) before checking custom domains.
4. Check custom domain assignment points to the latest successful deployment.
5. Ensure no stale domain redirect/proxy in front of Vercel is rewriting requests.
