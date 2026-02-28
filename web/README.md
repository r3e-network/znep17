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
# Non-secret defaults (RPC, vault hash, token allowlist, origin allowlist, verifier hash)
# are hardcoded for znep17.app testnet and can be overridden only if needed:
# RPC_URL=https://testnet1.neo.coz.io:443
# VAULT_HASH=0xa33b0788ad0324c5eb40ea803be8ed96f24d7fa6
# ALLOWED_TOKEN_HASHES=0x2a0010799d828155cf522f47c38e4e9d797a9697,0xd2a4cff31913016155e38e474a2c06d08be276cf
# RELAYER_ALLOWED_ORIGINS=http://localhost:3000
# Optional legacy HTTP testnet seeds (not recommended):
# RPC_URL=http://seed2t5.neo.org:20332
# RELAYER_ALLOW_INSECURE_RPC=true
# Tree updater (recommended: cron/server-to-server only)
MAINTAINER_VAULT_HASH=0xYourVaultContractHash
MAINTAINER_REQUIRE_AUTH=true
# By default maintainer uses existing relayer secrets:
# - signer: RELAYER_WIF
# - auth secret: RELAYER_API_KEY
# Optional overrides (only if you want dedicated maintainer credentials):
# MAINTAINER_WIF=MaintainerWifWithGas
# MAINTAINER_API_KEY=another-strong-random-secret
MAINTAINER_REQUIRE_DURABLE_LOCK=false
# Optional maintainer RPC override + legacy HTTP allowance:
# MAINTAINER_RPC_URL=http://seed5t5.neo.org:20332
# MAINTAINER_ALLOW_INSECURE_RPC=true
# Optional: override tree-update proving artifact locations
# MAINTAINER_TREE_UPDATE_WASM_PATH=/absolute/path/to/tree_update.wasm
# MAINTAINER_TREE_UPDATE_ZKEY_PATH=/absolute/path/to/tree_update_final.zkey
# Optional: pin expected on-chain verifier hash (recommended, required in production strong mode)
# RELAYER_EXPECTED_VERIFIER_HASH=0xYourVerifierContractHash
# Optional frontend deployment tuning:
# NEXT_PUBLIC_BASE_PATH=/app
# NEXT_PUBLIC_EXPLORER_TX_BASE_URL=https://testnet.neotube.io/transaction/
# Optional (defaults to false for safety):
# NEXT_PUBLIC_ALLOW_CUSTOM_VAULT_HASH=false
# Optional proof endpoint bootstrap cap (protects server from oversized cold rebuilds):
# RELAYER_MERKLE_MAX_BOOTSTRAP_LEAVES=50000
# Optional: keep maintainer controls hidden in public UI (default false):
# NEXT_PUBLIC_ENABLE_MAINTAINER_TOOLS=false
# Optional: bound per-run cache catch-up for maintainer endpoint:
# MAINTAINER_MAX_SYNC_LEAVES=20000
# MAINTAINER_RPC_TIMEOUT_MS=240000
ENV

npm run dev
```

## API

- `GET /api/relay`
  - returns `configured`, `relayerAddress`, `vaultHash`, `currentRoot`, `networkMagic`, `proofMode`, `guardStoreMode`
- `POST /api/relay`
  - expects SNARK proof payload, validates proof off-chain, submits `withdraw`
- `POST /api/maintainer`
  - server updater endpoint: syncs missing leaves from chain/Supabase cache, builds a Groth16 tree-update proof, and submits `updateMerkleRoot(proof, publicInputs, newRoot)` for the next leaf step
  - response includes `remainingLeaves`; invoke again until it reaches `0` to catch up fully

## Production Requirements

1. Configure secrets:
   - `RELAYER_WIF`
   - `RELAYER_API_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
2. Configure durable Redis:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
3. Browser UI does not embed relayer API keys; keep `RELAYER_REQUIRE_AUTH=false` for public web usage unless you add a trusted backend.
4. Configure the vault contract with the relayer address via `setRelayer`.
5. Keep `NEXT_PUBLIC_ALLOW_CUSTOM_VAULT_HASH=false` (default) so the UI cannot send deposits to arbitrary vault hashes.
6. Keep `NEXT_PUBLIC_ENABLE_MAINTAINER_TOOLS=false` in public deployments.
7. Configure maintainer endpoint hardening:
   - `MAINTAINER_REQUIRE_AUTH=true`
   - `RELAYER_API_KEY=<strong secret>` (or optional `MAINTAINER_API_KEY` override)
   - `MAINTAINER_REQUIRE_DURABLE_LOCK=true` with `KV_REST_API_URL` + `KV_REST_API_TOKEN`
8. Do not expose maintainer/relayer API keys to browser clients; invoke `/api/maintainer` from cron/server jobs.
9. For Vercel Cron, set `CRON_SECRET` to the same value as the maintainer auth secret (`MAINTAINER_API_KEY` or `RELAYER_API_KEY`).
10. Configure maintainer state backend:
   - `SUPABASE_URL` (or `NEXT_PUBLIC_SUPABASE_URL`)
   - `SUPABASE_SERVICE_ROLE_KEY`

## Vercel

The relayer and maintainer routes run in `runtime=nodejs` as dynamic API routes (`app/api/relay`, `app/api/maintainer`). Standard `next build --webpack` is used.

### Required Project Settings

1. Set **Root Directory** to `web`.
2. Keep **Framework Preset** as `Next.js`.
3. Do not set a custom **Output Directory**.
4. Keep install/build commands aligned with `web/vercel.json`:
   - `npm ci`
   - `npm run build`
5. Vercel Cron is configured in `web/vercel.json` to call `/api/maintainer` every minute.
6. The relayer also auto-kicks `/api/maintainer` (throttled) when a proof is pending finalization, so users do not need manual maintainer actions.

### Production Env Checklist (Vercel)

1. Use [`web/env.vercel.production.example`](./env.vercel.production.example) as the source template for all Production env vars in Vercel.
2. Populate secrets and addresses in Vercel Project Settings -> Environment Variables (Production).
   - For this deployment, keep `RELAYER_ALLOWED_ORIGINS=https://znep17.app,https://www.znep17.app`.
   - Keep `MAINTAINER_ALLOWED_ORIGINS=https://znep17.app,https://www.znep17.app` unless maintainer is called only from a separate backend/cron origin.
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
