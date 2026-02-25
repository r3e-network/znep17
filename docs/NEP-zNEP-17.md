# NEP Draft: zNEP-17 Zero-Knowledge Privacy Token Protocol (Revised)

## 1. Summary

zNEP-17 defines a privacy-vault pattern for NEP-17 assets on Neo N3: users deposit assets into a vault and later withdraw through zero-knowledge proofs without revealing linkable sender/recipient relationships.

This document is a reviewed and corrected draft aligned with currently verifiable Neo N3 primitives.

## 2. Verified Neo N3 Cryptography Surface

The following points were verified against Neo official repositories:

1. Neo N3 exposes BLS12-381 primitives through `CryptoLib` as:
   - `bls12381Serialize`
   - `bls12381Deserialize`
   - `bls12381Equal`
   - `bls12381Add`
   - `bls12381Mul`
   - `bls12381Pairing`
2. Neo N3 does **not** currently expose a one-shot syscall equivalent to `VerifyBLS12381Pairing(proof, publicInputs, vk)` for Groth16/PLONK verification.
3. No native `Poseidon` syscall was found in current Neo core sources.

References:

- https://github.com/neo-project/neo/blob/master/src/Neo/SmartContract/Native/CryptoLib.BLS12_381.cs
- https://github.com/neo-project/neo-devpack-dotnet/blob/master/src/Neo.SmartContract.Framework/Native/CryptoLib.BLS12_381.cs
- https://github.com/neo-project/neo/blob/master/src/Neo/SmartContract/Native/CryptoLib.cs

## 3. Consequence for zNEP-17 Design

Given current Neo capabilities, zNEP-17 should use a phased architecture:

1. Vault contract on Neo N3 maintains:
   - escrowed balances per asset
   - root history
   - nullifier spent set
2. Zero-knowledge verification is delegated to a pluggable verifier contract interface (`verify(...) -> bool`).
3. Merkle root construction can start with a deterministic rolling root placeholder and later migrate to Poseidon-tree logic when practical.

## 4. Revised Contract Interface (Implemented Prototype)

Implemented in `src/zNEP17.Protocol/zNEP17Protocol.cs`:

- `onNEP17Payment(UInt160 from, BigInteger amount, object data)` where `data = [stealthAddress, commitmentLeaf]`
- `UpdateMerkleRoot(byte[] newRoot)` gated by `TreeMaintainer` witness
- `Withdraw(UInt160 asset, byte[] proof, byte[] publicInputs, byte[] merkleRoot, byte[] nullifierHash, byte[] commitment, UInt160 recipient, UInt160 relayer, BigInteger amount, BigInteger fee)`
- `SetVerifier(UInt160 verifier)`
- `SetRelayer(UInt160 relayer)`
- `SetAssetAllowed(UInt160 asset, bool allowed)`
- `SetTreeMaintainer(UInt160 maintainer)`
- Read methods:
  - `GetVerifier`
  - `GetCurrentRoot`
  - `IsKnownRoot`
  - `IsNullifierUsed`
  - `GetAssetEscrowBalance`
  - `GetLeaf`

Events:

- `PrivacyDeposit(asset, stealthAddress, amount, leaf, index)`
- `PrivacyWithdraw(asset, recipient, amount, nullifier)`

## 5. Security Properties in Current Prototype

1. Replay protection: nullifier hash is stored and cannot be reused.
2. Root validity gate: withdrawal requires a known historical root.
3. Verifier gate: withdrawal requires external verifier approval.
4. Fee safety: `amount > fee` enforced before payout.
5. Deposit hardening: `onNEP17Payment` enforces strict 2-field payload, leaf length bounds, and commitment uniqueness.

## 6. Known Gaps Before Production

1. Rolling root is not a full Poseidon Merkle tree implementation.
2. No complete SNARK verifier circuit/audited verifier contract included.
3. Root publication still depends on a trusted `TreeMaintainer`; no trust-minimized on-chain Poseidon tree yet.
4. No advanced anti-MEV or envelope-transaction wiring in this repository.

## 7. Recommended Next Milestones

1. Implement/verifiy a dedicated zk verifier contract and integration tests in NeoVM test engine.
2. Replace rolling root placeholder with an audited Poseidon Merkle tree strategy.
3. Add relayer fee-market policy, slippage bounds, and griefing protections.
4. Add formal security review and property-based tests for nullifier/root invariants.
