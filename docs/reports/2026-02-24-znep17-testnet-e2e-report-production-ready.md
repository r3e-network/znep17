# zNEP-17 Testnet E2E Report (SNARK-Only Hardening)

## Execution

- Date (UTC): 2026-02-24
- RPC: `https://n3seed1.ngd.network:20332`
- Runner: `scripts/run-testnet-e2e.cjs`
- Artifact: `artifacts/testnet-e2e-2026-02-24T02-17-37_707Z.json`

## Result

All end-to-end scenarios passed.

- `success_path`: pass
- `verifier_rejects_keeps_state`: pass
- `unknown_root_rejected`: pass
- `fee_ge_amount_rejected`: pass
- `nullifier_replay_rejected`: pass
- `missing_verifier_rejected`: pass

Assertion summary:

- Failed assertions: `0`

## Deployed Contract Hashes (this run)

- Main vault: `0xc4279112d6e1239db22e6d0e399d09ab627d2cce`
- No-verifier vault: `0xf36e0019119c4fb87f60cefc5ca8faa05983e8cd`
- Token: `0x8e586d10dfbb35ce765768aff04adb7d6772d92f`
- Verifier: `0xebd5c5d002336bc7b67628df30bc4a4876a09b1b`

## Notes

- The runner now enforces secure RPC schemes (`https://`/`wss://`).
- `https://seed1t5.neo.org:20332` does not support TLS and was correctly rejected.
- `https://testnet1.neo.coz.io` was reachable but failed this contract set due syscall support mismatch (`System.Storage.Local.Put`).
- `https://n3seed1.ngd.network:20332` completed full deployment and scenario coverage successfully.
