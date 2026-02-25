# zNEP-17 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a compilable Neo N3 smart-contract prototype for zNEP-17 that supports privacy vault deposit/withdraw flow guards and a pluggable ZK verifier boundary.

**Architecture:** Implement a single vault contract (`zNEP17Protocol`) with strict storage primitives for Merkle root history, nullifier replay protection, and escrowed asset balances. Keep proof verification behind an internal verifier hook so current implementation can be deployed safely without assuming unavailable one-shot SNARK syscalls. Add tests for invariant-critical paths first (TDD).

**Tech Stack:** C#, .NET, Neo.SmartContract.Framework, Neo devpack compiler, xUnit (test skeleton).

### Task 1: Project Scaffolding

**Files:**
- Create: `src/zNEP17.Protocol/zNEP17.Protocol.csproj`
- Create: `src/zNEP17.Protocol/zNEP17Protocol.cs`
- Create: `src/zNEP17.Protocol/Properties/AssemblyInfo.cs`
- Create: `README.md`

**Step 1: Write the failing build expectation**

Define project layout with no implementation and run build expecting compile failure due missing contract class.

**Step 2: Run build to verify it fails**

Run: `dotnet build src/zNEP17.Protocol/zNEP17.Protocol.csproj`
Expected: FAIL with missing contract source or unresolved symbols.

**Step 3: Write minimal implementation**

Add contract skeleton with manifest metadata, events, storage key constants, and method signatures.

**Step 4: Run build to verify it passes**

Run: `dotnet build src/zNEP17.Protocol/zNEP17.Protocol.csproj`
Expected: PASS.

### Task 2: Deposit Flow (TDD)

**Files:**
- Modify: `src/zNEP17.Protocol/zNEP17Protocol.cs`
- Create: `tests/zNEP17.Protocol.Tests/DepositBehaviorTests.cs`

**Step 1: Write the failing test**

Add tests asserting deposit rejects invalid amount and unsupported calls.

**Step 2: Run test to verify it fails**

Run: `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj --filter Deposit`
Expected: FAIL for missing validation behavior.

**Step 3: Write minimal implementation**

Implement `Deposit` argument validation, NEP-17 transfer-in call, leaf insert, root tracking, event emission.

**Step 4: Run test to verify it passes**

Run same test command and expect PASS.

### Task 3: Withdraw Flow + Nullifier Protection (TDD)

**Files:**
- Modify: `src/zNEP17.Protocol/zNEP17Protocol.cs`
- Create: `tests/zNEP17.Protocol.Tests/WithdrawBehaviorTests.cs`

**Step 1: Write the failing test**

Add tests for root-not-known rejection, nullifier replay rejection, fee/amount checks.

**Step 2: Run test to verify it fails**

Run: `dotnet test tests/zNEP17.Protocol.Tests/zNEP17.Protocol.Tests.csproj --filter Withdraw`
Expected: FAIL with contract logic missing.

**Step 3: Write minimal implementation**

Implement `Withdraw` guards, verifier hook, nullifier marking, transfer split, event emission.

**Step 4: Run test to verify it passes**

Run same command and expect PASS.

### Task 4: Proposal and Verification Notes

**Files:**
- Create: `docs/NEP-zNEP-17.md`
- Modify: `README.md`

**Step 1: Write failing doc checklist**

Create checklist of assumptions to verify against Neo source.

**Step 2: Verify assumptions**

Check official source for BLS12-381 and syscall names.

**Step 3: Write minimal corrected proposal**

Capture compatible API names, constraints, and phased implementation boundaries.

**Step 4: Validate docs**

Run: `rg -n "TODO|TBD" docs/NEP-zNEP-17.md README.md`
Expected: No unresolved placeholders.
