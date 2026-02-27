using Neo;
using Neo.Network.P2P.Payloads;
using Neo.SmartContract.Testing;
using Neo.SmartContract.Testing.Exceptions;
using System;
using System.Numerics;
using Xunit;

namespace zNEP17.Protocol.Tests;

[Trait("IntegrationMode", "RealContracts")]
public class Znep17RealContractsIntegrationTests
{
    [Fact]
    public void DepositAndWithdraw_WithRealTokenAndVerifier_Succeeds()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer depositor = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer recipient = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer relayer = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = engine.Deploy<Neo.SmartContract.Testing.zNEP17Protocol>(
            Neo.SmartContract.Testing.zNEP17Protocol.Nef,
            Neo.SmartContract.Testing.zNEP17Protocol.Manifest,
            null);

        var token = engine.Deploy<Neo.SmartContract.Testing.TestNep17Token>(
            Neo.SmartContract.Testing.TestNep17Token.Nef,
            Neo.SmartContract.Testing.TestNep17Token.Manifest,
            null);

        var verifier = engine.Deploy<Neo.SmartContract.Testing.TestVerifier>(
            Neo.SmartContract.Testing.TestVerifier.Nef,
            Neo.SmartContract.Testing.TestVerifier.Manifest,
            null);

        token.MintForTesting(depositor.Account, 100);

        engine.SetTransactionSigners(owner);
        verifier.Result = true;
        vault.Verifier = verifier.Hash;
        vault.Relayer = relayer.Account;
        vault.SetAssetAllowed(token.Hash, true);


        engine.SetTransactionSigners(depositor);
        byte[] leaf = NewFixedBytes(0x51);
        token.Transfer(
            depositor.Account,
            vault.Hash,
            10,
            new object[] { stealth, leaf });

        Assert.Equal(new BigInteger(90), RequireBigInteger(token.BalanceOf(depositor.Account)));
        Assert.Equal(new BigInteger(10), RequireBigInteger(token.BalanceOf(vault.Hash)));

        byte[] root = PublishRoot(engine, vault, owner, 0x52);
        byte[] nullifier = NewFixedBytes(0x52);

        engine.SetTransactionSigners(relayer);
        vault.Withdraw(
            token.Hash,
            BuildProofPayload(0x01),
            BuildPublicInputsPayload(),
            root,
            nullifier,
            NewFixedBytes(0x99),
            recipient.Account,
            relayer.Account,
            10,
            2);

        Assert.Equal(BigInteger.Zero, RequireBigInteger(token.BalanceOf(vault.Hash)));
        Assert.Equal(new BigInteger(8), RequireBigInteger(token.BalanceOf(recipient.Account)));
        Assert.Equal(new BigInteger(2), RequireBigInteger(token.BalanceOf(relayer.Account)));
        Assert.True(RequireBool(vault.IsNullifierUsed(nullifier)));
    }

    [Fact]
    public void Withdraw_WithRealVerifierRejecting_LeavesVaultStateUnchanged()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer depositor = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer recipient = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = engine.Deploy<Neo.SmartContract.Testing.zNEP17Protocol>(
            Neo.SmartContract.Testing.zNEP17Protocol.Nef,
            Neo.SmartContract.Testing.zNEP17Protocol.Manifest,
            null);

        var token = engine.Deploy<Neo.SmartContract.Testing.TestNep17Token>(
            Neo.SmartContract.Testing.TestNep17Token.Nef,
            Neo.SmartContract.Testing.TestNep17Token.Manifest,
            null);

        var verifier = engine.Deploy<Neo.SmartContract.Testing.TestVerifier>(
            Neo.SmartContract.Testing.TestVerifier.Nef,
            Neo.SmartContract.Testing.TestVerifier.Manifest,
            null);

        token.MintForTesting(depositor.Account, 100);

        engine.SetTransactionSigners(owner);
        verifier.Result = true;
        vault.Verifier = verifier.Hash;
        vault.Relayer = owner.Account;
        vault.SetAssetAllowed(token.Hash, true);


        engine.SetTransactionSigners(depositor);
        byte[] leaf = NewFixedBytes(0x61);
        token.Transfer(
            depositor.Account,
            vault.Hash,
            10,
            new object[] { stealth, leaf });

        byte[] root = PublishRoot(engine, vault, owner, 0x62);
        engine.SetTransactionSigners(owner);
        verifier.Result = false;
        byte[] nullifier = NewFixedBytes(0x62);

        engine.SetTransactionSigners(owner);
        Assert.Throws<TestException>(() =>
            vault.Withdraw(
                token.Hash,
                BuildProofPayload(0x01),
                BuildPublicInputsPayload(),
                root,
                nullifier,
                NewFixedBytes(0x99),
                recipient.Account,
                owner.Account,
                10,
                1));

        Assert.Equal(new BigInteger(10), RequireBigInteger(token.BalanceOf(vault.Hash)));
        Assert.False(RequireBool(vault.IsNullifierUsed(nullifier)));
    }

    [Fact]
    public void Withdraw_WithUnknownRoot_Rejects_AndKeepsState()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer depositor = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer recipient = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = engine.Deploy<Neo.SmartContract.Testing.zNEP17Protocol>(
            Neo.SmartContract.Testing.zNEP17Protocol.Nef,
            Neo.SmartContract.Testing.zNEP17Protocol.Manifest,
            null);

        var token = engine.Deploy<Neo.SmartContract.Testing.TestNep17Token>(
            Neo.SmartContract.Testing.TestNep17Token.Nef,
            Neo.SmartContract.Testing.TestNep17Token.Manifest,
            null);

        var verifier = engine.Deploy<Neo.SmartContract.Testing.TestVerifier>(
            Neo.SmartContract.Testing.TestVerifier.Nef,
            Neo.SmartContract.Testing.TestVerifier.Manifest,
            null);

        token.MintForTesting(depositor.Account, 50);

        engine.SetTransactionSigners(owner);
        verifier.Result = true;
        vault.Verifier = verifier.Hash;
        vault.Relayer = owner.Account;
        vault.SetAssetAllowed(token.Hash, true);


        engine.SetTransactionSigners(depositor);
        byte[] leaf = NewFixedBytes(0x71);
        token.Transfer(
            depositor.Account,
            vault.Hash,
            10,
            new object[] { stealth, leaf });

        byte[] unknownRoot = NewFixedBytes(0x74);
        byte[] nullifier = NewFixedBytes(0x73);

        engine.SetTransactionSigners(owner);
        Assert.Throws<TestException>(() =>
            vault.Withdraw(
                token.Hash,
                BuildProofPayload(0x01),
                BuildPublicInputsPayload(),
                unknownRoot,
                nullifier,
                NewFixedBytes(0x99),
                recipient.Account,
                owner.Account,
                10,
                1));

        Assert.Equal(new BigInteger(10), RequireBigInteger(token.BalanceOf(vault.Hash)));
        Assert.False(RequireBool(vault.IsNullifierUsed(nullifier)));
    }

    [Fact]
    public void Withdraw_WithFeeGreaterOrEqualAmount_Rejects_AndKeepsState()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer depositor = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer recipient = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = engine.Deploy<Neo.SmartContract.Testing.zNEP17Protocol>(
            Neo.SmartContract.Testing.zNEP17Protocol.Nef,
            Neo.SmartContract.Testing.zNEP17Protocol.Manifest,
            null);

        var token = engine.Deploy<Neo.SmartContract.Testing.TestNep17Token>(
            Neo.SmartContract.Testing.TestNep17Token.Nef,
            Neo.SmartContract.Testing.TestNep17Token.Manifest,
            null);

        var verifier = engine.Deploy<Neo.SmartContract.Testing.TestVerifier>(
            Neo.SmartContract.Testing.TestVerifier.Nef,
            Neo.SmartContract.Testing.TestVerifier.Manifest,
            null);

        token.MintForTesting(depositor.Account, 50);

        engine.SetTransactionSigners(owner);
        verifier.Result = true;
        vault.Verifier = verifier.Hash;
        vault.Relayer = owner.Account;
        vault.SetAssetAllowed(token.Hash, true);


        engine.SetTransactionSigners(depositor);
        byte[] leaf = NewFixedBytes(0x81);
        token.Transfer(
            depositor.Account,
            vault.Hash,
            10,
            new object[] { stealth, leaf });

        byte[] root = PublishRoot(engine, vault, owner, 0x82);
        byte[] nullifier = NewFixedBytes(0x82);

        engine.SetTransactionSigners(owner);
        Assert.Throws<TestException>(() =>
            vault.Withdraw(
                token.Hash,
                BuildProofPayload(0x01),
                BuildPublicInputsPayload(),
                root,
                nullifier,
                NewFixedBytes(0x99),
                recipient.Account,
                owner.Account,
                10,
                10));

        Assert.Equal(new BigInteger(10), RequireBigInteger(token.BalanceOf(vault.Hash)));
        Assert.False(RequireBool(vault.IsNullifierUsed(nullifier)));
    }

    [Fact]
    public void Withdraw_WithoutVerifierConfigured_Rejects_AndKeepsState()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer depositor = TestEngine.GetNewSigner(WitnessScope.Global);
        Signer recipient = TestEngine.GetNewSigner(WitnessScope.Global);
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = engine.Deploy<Neo.SmartContract.Testing.zNEP17Protocol>(
            Neo.SmartContract.Testing.zNEP17Protocol.Nef,
            Neo.SmartContract.Testing.zNEP17Protocol.Manifest,
            null);

        var token = engine.Deploy<Neo.SmartContract.Testing.TestNep17Token>(
            Neo.SmartContract.Testing.TestNep17Token.Nef,
            Neo.SmartContract.Testing.TestNep17Token.Manifest,
            null);

        token.MintForTesting(depositor.Account, 50);
        engine.SetTransactionSigners(owner);
        vault.Relayer = owner.Account;
        vault.SetAssetAllowed(token.Hash, true);


        engine.SetTransactionSigners(depositor);
        byte[] nullifier = NewFixedBytes(0x92);
        byte[] root = NewFixedBytes(0x92);

        engine.SetTransactionSigners(owner);
        Assert.Throws<TestException>(() =>
            vault.Withdraw(
                token.Hash,
                BuildProofPayload(0x01),
                BuildPublicInputsPayload(),
                root,
                nullifier,
                NewFixedBytes(0x99),
                recipient.Account,
                owner.Account,
                10,
                1));

        Assert.Equal(new BigInteger(0), RequireBigInteger(token.BalanceOf(vault.Hash)));
        Assert.False(RequireBool(vault.IsNullifierUsed(nullifier)));
    }

    private static byte[] NewProof() { var p = new byte[192]; p[0] = 1; return p; }
    private static byte[] NewFixedBytes(byte b)
    {
        var value = new byte[32];
        Array.Fill(value, b);
        return value;
    }

    private static byte[] BuildProofPayload(byte firstByte)
    {
        byte[] payload = new byte[PrivacyGuards.Groth16ProofLength];
        payload[0] = firstByte;
        return payload;
    }

    private static byte[] BuildPublicInputsPayload(byte firstByte = 0x03)
    {
        byte[] payload = new byte[PrivacyGuards.Groth16PublicInputsLength];
        payload[0] = firstByte;
        return payload;
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
        vault.UpdateMerkleRoot(NewProof(), new byte[160], root);
        return root;
    }

    private static byte[] RequireBytes(byte[]? value) => value ?? throw new InvalidOperationException("Expected byte array.");
    private static bool RequireBool(bool? value) => value ?? throw new InvalidOperationException("Expected bool.");
    private static BigInteger RequireBigInteger(BigInteger? value) => value ?? throw new InvalidOperationException("Expected integer.");
}
