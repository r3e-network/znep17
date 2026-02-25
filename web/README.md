# zNEP-17 Privacy Vault - Web Frontend

This Next.js application provides the zNEP-17 user interface and a SNARK-verifying relayer endpoint for Neo N3.

## Features

1. **SNARK-only flow**: Browser-side Groth16 proof generation (`snarkjs` + Poseidon hashing via `poseidon-lite` + WASM).
2. **Relayer preflight checks**: strict request validation, bounded payload sizes, public-input binding checks, root/nullifier on-chain prechecks.
3. **Replay/abuse controls**: rate limiting + nullifier locks (in-memory for local dev, durable Redis in production).
4. **Server-bound withdrawal execution**: relayer signs withdraw tx; contract enforces configured relayer witness.
5. **Commitment-bound proofs**: public input schema binds `asset` + `commitment` to prevent cross-asset and amount-domain abuse.
6. **ZK artifact integrity guard**: `npm run verify:zk` pins SHA-256 checksums for `withdraw.wasm`, `withdraw_final.zkey`, and `verification_key.json`.

## Setup

```bash
npm install

cat > .env.local <<'ENV'
RPC_URL=https://n3seed1.ngd.network:20332
VAULT_HASH=0xYourVaultContractHash
RELAYER_WIF=YourFundedRelayerWIF
ALLOWED_TOKEN_HASHES=0xd2a4cff31913016155e38e474a2c06d08be276cf
RELAYER_ALLOWED_ORIGINS=http://localhost:3000
RELAYER_API_KEY=strong-random-secret
RELAYER_REQUIRE_AUTH=false
RELAYER_REQUIRE_ORIGIN_ALLOWLIST=true
RELAYER_REQUIRE_DURABLE_GUARDS=false
RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER=false
# Optional: pin expected on-chain verifier hash (recommended, required in production strong mode)
# RELAYER_EXPECTED_VERIFIER_HASH=0xYourVerifierContractHash
# Optional frontend deployment tuning:
# NEXT_PUBLIC_BASE_PATH=/app
# NEXT_PUBLIC_EXPLORER_TX_BASE_URL=https://testnet.ndora.org/transaction/
# Optional (defaults to false for safety):
# NEXT_PUBLIC_ALLOW_CUSTOM_VAULT_HASH=false
# Optional proof endpoint bootstrap cap (protects server from oversized cold rebuilds):
# RELAYER_MERKLE_MAX_BOOTSTRAP_LEAVES=50000
ENV

npm run dev
```

## API

- `GET /api/relay`
  - returns `configured`, `relayerAddress`, `vaultHash`, `currentRoot`, `networkMagic`, `proofMode`, `guardStoreMode`
- `POST /api/relay`
  - expects SNARK proof payload, validates proof off-chain, submits `withdraw`

## Production Requirements

1. Always configure:
   - `ALLOWED_TOKEN_HASHES=<one or more trusted token hashes>`
   - `RELAYER_REQUIRE_ORIGIN_ALLOWLIST=true`
   - `RELAYER_REQUIRE_DURABLE_GUARDS=true`
2. Configure durable Redis:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
3. Restrict origin/API access:
   - `RELAYER_ALLOWED_ORIGINS=<trusted origins>`
4. Choose auth mode:
   - Public browser relayer: `RELAYER_REQUIRE_AUTH=false` (recommended for public web UIs)
   - Private/internal clients: `RELAYER_REQUIRE_AUTH=true` and `RELAYER_API_KEY=<strong secret>`
5. Browser UI does not embed relayer API keys; when auth is enabled, use server-to-server or trusted client integrations.
6. Configure the vault contract with the relayer address via `setRelayer`.
7. Keep `RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER=true` in production (default); the relayer rejects weak/sentinel-style on-chain verifiers.
8. Set `RELAYER_EXPECTED_VERIFIER_HASH=<trusted verifier hash>` in production to pin the verifier contract identity.
9. Keep `NEXT_PUBLIC_ALLOW_CUSTOM_VAULT_HASH=false` (default) so the UI cannot send deposits to arbitrary vault hashes.

## Vercel

The relayer runs in `app/api/relay` (`runtime=nodejs`, dynamic route). Standard `next build --webpack` is used.
