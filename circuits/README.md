# zNEP-17 ZK Circuits

This directory contains the Zero-Knowledge (ZK) circuits required for generating cryptographic proofs of membership in the zNEP-17 anonymity set without revealing which specific deposit is being withdrawn.

## Circuit Architecture

The core of the privacy vault relies on a zk-SNARK circuit defined using `circom`.

### Core Flow:

1. **Deposit (On-Chain + Off-Chain state)**:
   - User generates a random `secret` and a `nullifier`.
   - User computes `commitment = Poseidon(nullifier, secret, amount, asset)`.
   - User deposits funds and appends the `commitment` (leaf) into the vault's on-chain Merkle tree.
   
2. **Withdrawal (Off-Chain Prover)**:
   - User computes `nullifierHash = Poseidon(nullifier)`.
   - User pulls the current `root` from the Neo N3 contract and constructs a Merkle proof (`pathElements` and `pathIndices`) for their specific `commitment`.
   - User generates a zk-SNARK proof using `withdraw.circom` that cryptographically proves:
     - They know a `(secret, nullifier)` pair that hashes to a leaf inside the tree represented by `root`.
     - The commitment is bound to the exact `amount` and `asset`.
     - The `nullifierHash` exposed publicly corresponds exactly to their `nullifier`.
     - The transaction parameters (`recipient`, `relayer`, `amount`, `fee`, `asset`, `commitment`) are mathematically bound to the proof to prevent front-running and cross-domain replay.

3. **Verification (On-Chain Verifier Contract)**:
   - The Neo N3 verifier contract takes the `proof`, `nullifierHash`, `root`, and transaction metadata.
   - It runs the PLONK/Groth16 pairing checks on the BLS12-381 curve.
   - If the proof is valid, the vault releases the funds, marks `nullifierHash` as used to prevent double-spending, and pays the `relayer`.

## Setup and Compilation

To compile and test the circuits, you will need the Rust-based `circom` compiler and `snarkjs` installed globally.

### Requirements

```bash
# 1. Install Circom
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom

# 2. Install snarkjs
npm install -g snarkjs
```

### Compiling the Circuit

```bash
# 1. Compile the r1cs and wasm files
circom withdraw.circom --r1cs --wasm --sym

# 2. Start the Powers of Tau setup phase (Groth16 example)
snarkjs powersoftau new bn128 15 pot15_0000.ptau -v
snarkjs powersoftau contribute pot15_0000.ptau pot15_0001.ptau --name="First contribution" -v

# 3. Setup Phase 2
snarkjs powersoftau prepare phase2 pot15_0001.ptau pot15_final.ptau -v
snarkjs groth16 setup withdraw.r1cs pot15_final.ptau withdraw_0000.zkey

# 4. Contribute to Phase 2
snarkjs zkey contribute withdraw_0000.zkey withdraw_0001.zkey --name="1st Contributor Name" -v

# 5. Export Verification Key
snarkjs zkey export verificationkey withdraw_0001.zkey verification_key.json
```

## Neo N3 Integration

Once the circuit is compiled and the `verification_key.json` is generated, a Neo N3 Smart Contract must be deployed that hardcodes the BLS12-381 points inside the `Verify` method. 

The vault contract invokes the verifier contract at:

```csharp
[Safe]
public static bool Verify(
    UInt160 asset,
    byte[] proof,
    byte[] publicInputs,
    byte[] merkleRoot,
    byte[] nullifierHash,
    byte[] commitment,
    UInt160 recipient,
    UInt160 relayer,
    BigInteger amount,
    BigInteger fee
)
```

The verifier asserts the integrity of the Groth16 pairings across these public inputs mapped directly to the circuit `public [...]` signals in this order:

`root, nullifierHash, recipient, relayer, amount, fee, asset, commitment`
