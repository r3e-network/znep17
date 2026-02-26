using Neo;
using Neo.Network.P2P.Payloads;
using Neo.SmartContract.Testing;
using Neo.SmartContract.Testing.Exceptions;
using System;
using System.Numerics;
using System.Reflection;
using Xunit;

namespace zNEP17.Protocol.Tests;

[Trait("IntegrationMode", "Governance")]
public class GovernanceBehaviorTests
{
    [Fact]
    public void SetPaused_And_SetVerifier_AreOwnerOnly()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer outsider = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 verifierHash = TestEngine.GetNewSigner().Account;
        UInt160 relayerHash = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);

        engine.SetTransactionSigners(outsider);
        Assert.Throws<TestException>(() => vault.SetPaused(true));
        Assert.Throws<TestException>(() => vault.Verifier = verifierHash);
        Assert.Throws<TestException>(() => vault.Relayer = relayerHash);

        engine.SetTransactionSigners(owner);
        vault.SetPaused(true);
        Assert.True(RequireBool(vault.IsPaused));

        vault.Verifier = verifierHash;
        Assert.Equal(verifierHash, RequireHash(vault.Verifier));
        vault.Relayer = relayerHash;
        Assert.Equal(relayerHash, RequireHash(vault.Relayer));
    }

    [Fact]
    public void OwnershipTransfer_RequiresPendingOwnerWitness()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer pendingOwner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer outsider = TestEngine.GetNewSigner(WitnessScope.Global);

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);

        vault.TransferOwnership(pendingOwner.Account);
        Assert.Equal(pendingOwner.Account, RequireHash(vault.PendingOwner));

        engine.SetTransactionSigners(outsider);
        Assert.Throws<TestException>(() => vault.AcceptOwnership());

        engine.SetTransactionSigners(pendingOwner);
        vault.AcceptOwnership();
        Assert.Equal(pendingOwner.Account, RequireHash(vault.Owner));
        Assert.Equal(UInt160.Zero, RequireHash(vault.PendingOwner));
    }

    [Fact]
    public void OwnershipTransfer_RejectsPendingOwnerThatEqualsSecurityCouncil()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer council = TestEngine.GetNewSigner(WitnessScope.Global);

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);
        vault.SecurityCouncil = council.Account;
        vault.TransferOwnership(council.Account);

        engine.SetTransactionSigners(council);
        Assert.Throws<TestException>(() => vault.AcceptOwnership());
    }

    [Fact]
    public void SecurityCouncil_CanOnlyBeSetOnce_AndOnlyByOwner()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer outsider = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer councilA = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer councilB = TestEngine.GetNewSigner(WitnessScope.Global);

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);

        engine.SetTransactionSigners(outsider);
        Assert.Throws<TestException>(() => vault.SecurityCouncil = councilA.Account);

        engine.SetTransactionSigners(owner);
        vault.SecurityCouncil = councilA.Account;
        Assert.Equal(councilA.Account, RequireHash(vault.SecurityCouncil));
        Assert.Throws<TestException>(() => vault.SecurityCouncil = councilB.Account);
    }

    [Fact]
    public void VerifierAndRelayer_UpdateRequireScheduledTimelockPath()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer council = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 verifierA = TestEngine.GetNewSigner().Account;
        UInt160 verifierB = TestEngine.GetNewSigner().Account;
        UInt160 relayerA = TestEngine.GetNewSigner().Account;
        UInt160 relayerB = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);

        vault.Verifier = verifierA;
        vault.Relayer = relayerA;

        Assert.Throws<TestException>(() => vault.Verifier = verifierB);
        Assert.Throws<TestException>(() => vault.Relayer = relayerB);

        Assert.Throws<TestException>(() => vault.ScheduleVerifierUpdate(verifierB));
        Assert.Throws<TestException>(() => vault.ScheduleRelayerUpdate(relayerB));

        vault.SecurityCouncil = council.Account;
        engine.SetTransactionSigners(owner, council);
        vault.ScheduleVerifierUpdate(verifierB);
        vault.ScheduleRelayerUpdate(relayerB);
        Assert.Equal(verifierB, RequireHash(vault.PendingVerifier));
        Assert.Equal(relayerB, RequireHash(vault.PendingRelayer));
        Assert.True(RequireBigInteger(vault.PendingVerifierReadyAt) > 0);
        Assert.True(RequireBigInteger(vault.PendingRelayerReadyAt) > 0);

        Assert.Throws<TestException>(() =>
        {
            engine.SetTransactionSigners(owner);
            vault.CancelVerifierUpdate();
        });
        Assert.Throws<TestException>(() =>
        {
            engine.SetTransactionSigners(owner);
            vault.CancelRelayerUpdate();
        });

        engine.SetTransactionSigners(owner, council);
        vault.CancelVerifierUpdate();
        vault.CancelRelayerUpdate();
        Assert.Equal(UInt160.Zero, RequireHash(vault.PendingVerifier));
        Assert.Equal(UInt160.Zero, RequireHash(vault.PendingRelayer));

        vault.ScheduleVerifierUpdate(verifierB);
        vault.ScheduleRelayerUpdate(relayerB);

        Assert.Throws<TestException>(() =>
        {
            engine.SetTransactionSigners(owner);
            vault.ApplyVerifierUpdate();
        });
        Assert.Throws<TestException>(() =>
        {
            engine.SetTransactionSigners(owner);
            vault.ApplyRelayerUpdate();
        });

        engine.SetTransactionSigners(owner, council);
        Assert.Throws<TestException>(() => vault.ApplyVerifierUpdate());
        Assert.Throws<TestException>(() => vault.ApplyRelayerUpdate());
    }

    [Fact]
    public void AssetAllowlist_IsOwnerOnly_AndCanBeToggled()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer outsider = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer depositor = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);
        var token = DeployToken(engine);
        token.MintForTesting(depositor.Account, 10);

        engine.SetTransactionSigners(outsider);
        Assert.Throws<TestException>(() => vault.SetAssetAllowed(token.Hash, true));

        engine.SetTransactionSigners(owner);
        vault.SetAssetAllowed(token.Hash, true);
        Assert.True(RequireBool(vault.IsAssetAllowed(token.Hash)));

        engine.SetTransactionSigners(depositor);
        token.Transfer(
            depositor.Account,
            vault.Hash,
            1,
            new object[] { stealth, NewFixedBytes(0x10) });

        engine.SetTransactionSigners(owner);
        vault.SetAssetAllowed(token.Hash, false);
        Assert.False(RequireBool(vault.IsAssetAllowed(token.Hash)));

        engine.SetTransactionSigners(depositor);
        Assert.Throws<TestException>(() =>
            token.Transfer(
                depositor.Account,
                vault.Hash,
                1,
                new object[] { stealth, NewFixedBytes(0x11) }));
    }

    [Fact]
    public void Deposit_Requires_AssetAllowlist()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer depositor = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);
        var token = DeployToken(engine);
        token.MintForTesting(depositor.Account, 10);

        engine.SetTransactionSigners(depositor);
        Assert.Throws<TestException>(() => token.Transfer(depositor.Account, vault.Hash, 1, new object[] { stealth, NewFixedBytes(0x55) }));
    }

    [Fact]
    public void Pause_Blocks_Deposit_And_Withdraw()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer depositor = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer recipient = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer relayer = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);
        var token = DeployToken(engine);
        var verifier = DeployVerifier(engine);
        verifier.Result = true;
        vault.Verifier = verifier.Hash;
        vault.Relayer = relayer.Account;
        vault.SetAssetAllowed(token.Hash, true);
        vault.TreeMaintainer = owner.Account;

        token.MintForTesting(depositor.Account, 100);
        byte[] leaf = NewFixedBytes(0x41);

        vault.SetPaused(true);
        engine.SetTransactionSigners(depositor);
        Assert.Throws<TestException>(() => token.Transfer(depositor.Account, vault.Hash, 10, new object[] { stealth, leaf }));

        engine.SetTransactionSigners(owner);
        vault.SetPaused(false);
        engine.SetTransactionSigners(depositor);
        token.Transfer(depositor.Account, vault.Hash, 10, new object[] { stealth, leaf });

        byte[] root = PublishRoot(engine, vault, owner, 0x43);
        byte[] nullifier = NewFixedBytes(0x42);

        engine.SetTransactionSigners(owner);
        vault.SetPaused(true);
        engine.SetTransactionSigners(relayer);
        Assert.Throws<TestException>(() =>
            vault.Withdraw(
                token.Hash,
                new byte[] { 0x01 },
                new byte[] { 0x02, 0x03 },
                root,
                nullifier,
                NewFixedBytes(0x99),
                recipient.Account,
                relayer.Account,
                10,
                1));
    }

    [Fact]
    public void Deposits_KeepLeafHistory_And_PruneStaleRoots()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer depositor = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);
        var token = DeployToken(engine);
        vault.SetAssetAllowed(token.Hash, true);
        vault.TreeMaintainer = owner.Account;
        token.MintForTesting(depositor.Account, PrivacyGuards.MaxRootHistoryEntries + 5);

        byte[]? firstRoot = null;
        byte[]? latestRoot = null;

        for (int i = 0; i < PrivacyGuards.MaxRootHistoryEntries + 1; i++)
        {
            engine.SetTransactionSigners(depositor);
            token.Transfer(
                depositor.Account,
                vault.Hash,
                1,
                new object[] { stealth, NewFixedBytes((byte)(i + 1)) });

            byte[] nextRoot = PublishRoot(engine, vault, owner, (byte)(i + 100));
            latestRoot = nextRoot;

            if (i == 0)
            {
                firstRoot = nextRoot;
            }
        }

        Assert.NotNull(firstRoot);
        Assert.NotNull(latestRoot);
        Assert.False(RequireBool(vault.IsKnownRoot(firstRoot!)));
        Assert.True(RequireBool(vault.IsKnownRoot(latestRoot!)));
        Assert.Equal(NewFixedBytes(0x01), RequireBytes(vault.GetLeaf(0)));
        Assert.Equal(NewFixedBytes((byte)(PrivacyGuards.MaxRootHistoryEntries + 1)), RequireBytes(vault.GetLeaf(PrivacyGuards.MaxRootHistoryEntries)));
    }

    [Fact]
    public void UpdateMerkleRoot_Rejects_StaleExpectedLeafCount()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer depositor = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);
        var token = DeployToken(engine);
        vault.SetAssetAllowed(token.Hash, true);
        vault.TreeMaintainer = owner.Account;
        token.MintForTesting(depositor.Account, 20);

        byte[] commitment = NewFixedBytes(0x88);
        engine.SetTransactionSigners(depositor);
        token.Transfer(depositor.Account, vault.Hash, 10, new object[] { stealth, commitment });

        engine.SetTransactionSigners(owner);
        Assert.Throws<TestException>(() => vault.UpdateMerkleRoot(NewFixedBytes(0x89), 0));

        BigInteger leafCount = RequireBigInteger(vault.LeafIndex);
        byte[] root = NewFixedBytes(0x8A);
        vault.UpdateMerkleRoot(root, leafCount);
        Assert.True(RequireBool(vault.IsKnownRoot(root)));
    }

    [Fact]
    public void Deposit_Rejects_DuplicateCommitmentLeaf()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer depositor = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);
        var token = DeployToken(engine);
        vault.SetAssetAllowed(token.Hash, true);
        vault.TreeMaintainer = owner.Account;
        token.MintForTesting(depositor.Account, 30);

        byte[] commitment = NewFixedBytes(0x90);
        engine.SetTransactionSigners(depositor);
        token.Transfer(depositor.Account, vault.Hash, 10, new object[] { stealth, commitment });
        Assert.Throws<TestException>(() =>
            token.Transfer(depositor.Account, vault.Hash, 5, new object[] { stealth, commitment }));

        Assert.Equal(new BigInteger(1), RequireBigInteger(vault.LeafIndex));
        Assert.Equal(commitment, RequireBytes(vault.GetLeaf(0)));
        Assert.Equal(new BigInteger(10), RequireBigInteger(vault.GetAssetEscrowBalance(token.Hash)));
    }

    [Fact]
    public void Withdraw_Rejects_WhenCommitmentAlreadySpent()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer depositor = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer recipient = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);
        var token = DeployToken(engine);
        var verifier = DeployVerifier(engine);
        verifier.Result = true;
        vault.Verifier = verifier.Hash;
        vault.Relayer = owner.Account;
        vault.SetAssetAllowed(token.Hash, true);
        vault.TreeMaintainer = owner.Account;
        token.MintForTesting(depositor.Account, 30);

        byte[] commitment = NewFixedBytes(0x91);
        engine.SetTransactionSigners(depositor);
        token.Transfer(depositor.Account, vault.Hash, 10, new object[] { stealth, commitment });

        byte[] root = PublishRoot(engine, vault, owner, 0x92);
        byte[] nullifierA = NewFixedBytes(0x93);
        byte[] nullifierB = NewFixedBytes(0x94);

        engine.SetTransactionSigners(owner);
        byte[] proof = new byte[PrivacyGuards.Groth16ProofLength];
        byte[] publicInputs = new byte[PrivacyGuards.Groth16PublicInputsLength];
        proof[0] = 0x01;
        publicInputs[0] = 0x02;
        vault.Withdraw(
            token.Hash,
            proof,
            publicInputs,
            root,
            nullifierA,
            NewFixedBytes(0x99),
            recipient.Account,
            owner.Account,
            10,
            1);

        Assert.Throws<TestException>(() =>
            vault.Withdraw(
                token.Hash,
                proof,
                publicInputs,
                root,
                nullifierB,
                NewFixedBytes(0x99),
                recipient.Account,
                owner.Account,
                10,
                1));

        Assert.True(RequireBool(vault.IsNullifierUsed(nullifierA)));
        Assert.False(RequireBool(vault.IsNullifierUsed(nullifierB)));
        Assert.Equal(new BigInteger(9), RequireBigInteger(token.BalanceOf(recipient.Account)));
    }

    [Fact]
    public void SecurityCouncilRotation_RequiresOwnerAndCouncilWitness()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer council = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer newCouncil = TestEngine.GetNewSigner(WitnessScope.Global);

        engine.SetTransactionSigners(owner);
        var vault = DeployVault(engine);
        vault.SecurityCouncil = council.Account;

        Assert.Throws<TestException>(() => vault.ScheduleSecurityCouncilUpdate(newCouncil.Account));

        engine.SetTransactionSigners(owner, council);
        vault.ScheduleSecurityCouncilUpdate(newCouncil.Account);
        Assert.Equal(newCouncil.Account, RequireHash(vault.PendingSecurityCouncil));
        Assert.True(RequireBigInteger(vault.PendingSecurityCouncilReadyAt) > 0);

        engine.SetTransactionSigners(owner);
        Assert.Throws<TestException>(() => vault.CancelSecurityCouncilUpdate());

        engine.SetTransactionSigners(owner, council);
        vault.CancelSecurityCouncilUpdate();
        Assert.Equal(UInt160.Zero, RequireHash(vault.PendingSecurityCouncil));

        vault.ScheduleSecurityCouncilUpdate(newCouncil.Account);
        Assert.Throws<TestException>(() => vault.ApplySecurityCouncilUpdate());

        AdvanceEngineTime(engine, TimeSpan.FromSeconds((double)PrivacyGuards.SecurityCouncilUpdateDelaySeconds + 1));

        engine.SetTransactionSigners(owner);
        Assert.Throws<TestException>(() => vault.ApplySecurityCouncilUpdate());

        engine.SetTransactionSigners(owner, council);
        vault.ApplySecurityCouncilUpdate();
        Assert.Equal(newCouncil.Account, RequireHash(vault.SecurityCouncil));
    }

    private static Neo.SmartContract.Testing.zNEP17Protocol DeployVault(TestEngine engine)
    {
        return engine.Deploy<Neo.SmartContract.Testing.zNEP17Protocol>(
            Neo.SmartContract.Testing.zNEP17Protocol.Nef,
            Neo.SmartContract.Testing.zNEP17Protocol.Manifest,
            null);
    }

    private static Neo.SmartContract.Testing.TestNep17Token DeployToken(TestEngine engine)
    {
        return engine.Deploy<Neo.SmartContract.Testing.TestNep17Token>(
            Neo.SmartContract.Testing.TestNep17Token.Nef,
            Neo.SmartContract.Testing.TestNep17Token.Manifest,
            null);
    }

    private static Neo.SmartContract.Testing.TestVerifier DeployVerifier(TestEngine engine)
    {
        return engine.Deploy<Neo.SmartContract.Testing.TestVerifier>(
            Neo.SmartContract.Testing.TestVerifier.Nef,
            Neo.SmartContract.Testing.TestVerifier.Manifest,
            null);
    }

    private static byte[] NewFixedBytes(byte b)
    {
        var value = new byte[32];
        Array.Fill(value, b);
        return value;
    }

    private static byte[] PublishRoot(
        TestEngine engine,
        Neo.SmartContract.Testing.zNEP17Protocol vault,
        Signer owner,
        byte rootSeed)
    {
        byte[] root = NewFixedBytes(rootSeed);
        engine.SetTransactionSigners(owner);
        BigInteger leafCount = RequireBigInteger(vault.LeafIndex);
        vault.UpdateMerkleRoot(root, leafCount);
        return root;
    }

    private static void AdvanceEngineTime(TestEngine engine, TimeSpan delta)
    {
        PropertyInfo? blockProperty = engine.GetType().GetProperty("PersistingBlock", BindingFlags.Public | BindingFlags.Instance);
        object block = blockProperty?.GetValue(engine)
            ?? throw new InvalidOperationException("PersistingBlock is unavailable on TestEngine.");

        MethodInfo? advance = block.GetType().GetMethod("Advance", new[] { typeof(TimeSpan) });
        if (advance is not null)
        {
            advance.Invoke(block, new object[] { delta });
            return;
        }

        throw new InvalidOperationException("PersistingBlock.Advance(TimeSpan) is unavailable.");
    }

    private static bool RequireBool(bool? value) => value ?? throw new InvalidOperationException("Expected bool.");
    private static UInt160 RequireHash(UInt160? value) => value ?? throw new InvalidOperationException("Expected hash.");
    private static byte[] RequireBytes(byte[]? value) => value ?? throw new InvalidOperationException("Expected byte array.");
    private static BigInteger RequireBigInteger(BigInteger? value) => value ?? throw new InvalidOperationException("Expected integer.");
}
