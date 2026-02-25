# zNEP-17 for Neo N3

This repository implements a SNARK-verified zNEP-17 privacy vault stack for Neo N3, including smart contracts, relayer, frontend, and real testnet e2e validation.

## Implemented

- Neo N3 vault contract: `src/zNEP17.Protocol/zNEP17Protocol.cs`
- Deposit flow with commitment leaf ingestion and on-chain note metadata binding (`commitment -> asset + amount + index`)
- Root publication flow via dedicated tree maintainer (`setTreeMaintainer` + `updateMerkleRoot`)
- Withdraw flow with root/nullifier/commitment checks, verifier boundary, and relayer-witness enforcement
- Replay protection with full on-chain leaf history and bounded known-root history
- Commitment replay protection (`isCommitmentSpent`) in addition to nullifier replay protection
- Fee=0 self-claim fallback (recipient witness path) for relayer liveness
- Asset allowlist gating for deposits (`setAssetAllowed` / `isAssetAllowed`)
- Timelocked governance update path for verifier/relayer rotation (`schedule*Update` + `apply*Update`)
- Dual-control governance for verifier/relayer rotations (owner + `securityCouncil` witness required)
- Guard-layer validation for request bounds and amounts
- Frontend + relayer in `web/` (SNARK-only mode)
- CI workflow: `.github/workflows/ci.yml`

## Build and Test

```bash
dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj
cd web
npm run lint
npx tsc --noEmit
npm run build
```

## Real Testnet E2E

Runner:

- `scripts/run-testnet-e2e.cjs`

Run:

```bash
export ZNEP17_TESTNET_WIF='<testnet-wif>'
export ZNEP17_TESTNET_RPC='https://n3seed1.ngd.network:20332' # optional
npm run testnet:e2e
```

What it verifies:

- successful `Deposit -> Withdraw`
- tree-maintainer `updateMerkleRoot` flow after each deposit
- verifier rejection keeps state unchanged
- unknown root rejection
- `fee >= amount` rejection
- commitment amount-binding rejection
- nullifier replay rejection
- missing verifier rejection on secondary vault

Output:

- `artifacts/testnet-e2e-<timestamp>.json`

## Testing Artifacts Regeneration

After contract ABI changes:

```bash
./scripts/regenerate-testing-artifacts.sh
```

## Verifier Boundary

`withdraw` expects verifier method:

- name: `verify`
- return: `bool`
- args: `asset`, `proof`, `publicInputs`, `merkleRoot`, `nullifierHash`, `commitment`, `recipient`, `relayer`, `amount`, `fee`

`publicInputs` are bound to an 8-signal schema:

- `root`, `nullifierHash`, `recipient`, `relayer`, `amount`, `fee`, `asset`, `commitment`

Additionally, contract execution requires:

- configured relayer witness when `fee > 0`
- recipient witness self-claim when `fee == 0`
- deposits only from owner-allowlisted assets

Relayer production hardening:

- set `RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER=true`
- set `RELAYER_EXPECTED_VERIFIER_HASH=<trusted verifier hash>` to pin verifier identity

## Governance Operations

- One-time security council initialization: `setSecurityCouncil`
- Security council rotation:
  - `scheduleSecurityCouncilUpdate` (owner + council witness, timelocked)
  - `applySecurityCouncilUpdate` (owner + council witness, timelocked)
  - `cancelSecurityCouncilUpdate` (owner + council witness)
- Verifier rotation:
  - `scheduleVerifierUpdate` (owner + council witness)
  - `applyVerifierUpdate` (owner + council witness, timelocked)
  - `cancelVerifierUpdate` (owner + council witness)
- Relayer rotation:
  - `scheduleRelayerUpdate` (owner + council witness)
  - `applyRelayerUpdate` (owner + council witness, timelocked)
  - `cancelRelayerUpdate` (owner + council witness)
- Emergency controls:
  - `enableEmergencyWithdraw` (owner, while paused, timelocked)
  - `emergencyWithdraw` (requires paused state + depositor witness)
  - `disableEmergencyWithdraw` (owner)
