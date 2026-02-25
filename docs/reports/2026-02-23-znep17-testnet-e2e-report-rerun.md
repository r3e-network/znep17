# zNEP17 Testnet E2E Acceptance Report (Rerun)

- Generated: 2026-02-23T23:49:13.305Z
- Source Report: `artifacts/testnet-e2e-2026-02-23T23-49-13_305Z.json`
- RPC: `http://seed1t5.neo.org:20332`
- Network Magic: `894710606`
- Start (UTC): `2026-02-23T23:46:42.181Z`
- End (UTC): `2026-02-23T23:49:13.305Z`
- Success: `true`

## Deployed Contracts

| Alias | Name | Hash | Checksum |
|---|---|---|---|
| token | TestNep17Token | `889fa18ffc7317ca6b5a33f1d85659e89ac7ab12` | `2226581547` |
| verifier | TestVerifier | `f231737a7945b4a40866b257d01ea791a4364af9` | `39530439` |
| vaultMain | zNEP17Protocol | `6ad3090700c8279ed53d9ed81c6411ddaa165842` | `2877792528` |
| vaultNoVerifier | zNEP17Protocol | `629c689fdecbd140023419d4e099f92744e7f59c` | `2877792528` |

## Scenario Matrix

| Scenario | Pass |
|---|---|
| success_path | YES |
| verifier_rejects_keeps_state | YES |
| unknown_root_rejected | YES |
| fee_ge_amount_rejected | YES |
| nullifier_replay_rejected | YES |
| missing_verifier_rejected | YES |

## Transaction Summary

- Total tx: **28**
- HALT: **23**
- FAULT (expected failure-path assertions): **5**

## Notes

- This rerun used the user-provided TestNet WIF and completed successfully.
- The run also validates all designed negative-path assertions (`zk proof invalid`, `unknown merkle root`, `invalid withdraw arguments`, `nullifier already used`).
