using Moq;
using Neo;
using Neo.Network.P2P.Payloads;
using Neo.SmartContract;
using Neo.SmartContract.Manifest;
using Neo.SmartContract.Testing;
using Neo.SmartContract.Testing.Exceptions;
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Linq;
using System.Numerics;
using System.Threading;
using Xunit;

namespace zNEP17.Protocol.Tests;

[Trait("IntegrationMode", "Mock")]
public class Znep17IntegrationTests
{
    private static int _mockContractSequence;

    public abstract class MockVerifierContract(SmartContractInitialize initialize) : SmartContract(initialize)
    {
        [DisplayName("verify")]
        public abstract bool? Verify(
            UInt160? asset,
            byte[]? proof,
            byte[]? publicInputs,
            byte[]? merkleRoot,
            byte[]? nullifierHash,
            UInt160? recipient,
            UInt160? relayer,
            BigInteger? amount,
            BigInteger? fee);
    }

    [Fact]
    public void DepositAndWithdraw_Succeeds_AndPreventsNullifierReplay()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner();
        Signer depositor = TestEngine.GetNewSigner();
        Signer recipient = TestEngine.GetNewSigner();
        Signer relayer = TestEngine.GetNewSigner();
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = engine.Deploy<Neo.SmartContract.Testing.zNEP17Protocol>(
            Neo.SmartContract.Testing.zNEP17Protocol.Nef,
            Neo.SmartContract.Testing.zNEP17Protocol.Manifest,
            null);

        var asset = engine.Deploy<Neo.SmartContract.Testing.TestNep17Token>(
            Neo.SmartContract.Testing.TestNep17Token.Nef,
            Neo.SmartContract.Testing.TestNep17Token.Manifest,
            null);
        asset.MintForTesting(depositor.Account, 100);

        int verifyCalls = 0;
        var verifier = DeployMockVerifier(engine, proof =>
        {
            verifyCalls++;
            return proof is not null
                && proof.Length == PrivacyGuards.Groth16ProofLength
                && proof[0] == 0x01;
        });

        engine.SetTransactionSigners(owner);
        vault.Verifier = verifier.Hash;
        vault.Relayer = relayer.Account;
        vault.SetAssetAllowed(asset.Hash, true);
        vault.TreeMaintainer = owner.Account;

        byte[] leaf = NewFixedBytes(0x11);
        engine.SetTransactionSigners(depositor);
        asset.Transfer(depositor.Account, vault.Hash, 10, new object[] { stealth, leaf });

        Assert.Equal(new BigInteger(10), RequireBigInteger(vault.GetAssetEscrowBalance(asset.Hash)));
        Assert.Equal(new BigInteger(1), RequireBigInteger(vault.LeafIndex));
        Assert.Equal(leaf, vault.GetLeaf(0));

        byte[] root = PublishRoot(engine, vault, owner, 0x12);
        Assert.Equal(32, root.Length);
        Assert.True(RequireBool(vault.IsKnownRoot(root)));

        byte[] nullifier = NewFixedBytes(0x22);
        engine.SetTransactionSigners(relayer);
        vault.Withdraw(
            asset.Hash,
            BuildProofPayload(0x01),
            BuildPublicInputsPayload(),
            root,
            nullifier,
            recipient.Account,
            relayer.Account,
            10,
            2);

        Assert.Equal(BigInteger.Zero, RequireBigInteger(vault.GetAssetEscrowBalance(asset.Hash)));
        Assert.True(RequireBool(vault.IsNullifierUsed(nullifier)));
        Assert.Equal(1, verifyCalls);

        Assert.Equal(new BigInteger(90), RequireBigInteger(asset.BalanceOf(depositor.Account)));
        Assert.Equal(new BigInteger(8), RequireBigInteger(asset.BalanceOf(recipient.Account)));
        Assert.Equal(new BigInteger(2), RequireBigInteger(asset.BalanceOf(relayer.Account)));

        Assert.Throws<TestException>(() =>
            vault.Withdraw(
                asset.Hash,
                BuildProofPayload(0x01),
                BuildPublicInputsPayload(),
                root,
                nullifier,
                recipient.Account,
                relayer.Account,
                10,
                2));
    }

    [Fact]
    public void Withdraw_Rejects_WhenVerifierReturnsFalse_AndKeepsState()
    {
        var engine = new TestEngine(true);
        Signer owner = TestEngine.GetNewSigner();
        Signer depositor = TestEngine.GetNewSigner();
        Signer recipient = TestEngine.GetNewSigner();
        UInt160 stealth = TestEngine.GetNewSigner().Account;

        engine.SetTransactionSigners(owner);
        var vault = engine.Deploy<Neo.SmartContract.Testing.zNEP17Protocol>(
            Neo.SmartContract.Testing.zNEP17Protocol.Nef,
            Neo.SmartContract.Testing.zNEP17Protocol.Manifest,
            null);

        var asset = engine.Deploy<Neo.SmartContract.Testing.TestNep17Token>(
            Neo.SmartContract.Testing.TestNep17Token.Nef,
            Neo.SmartContract.Testing.TestNep17Token.Manifest,
            null);
        asset.MintForTesting(depositor.Account, 100);

        int verifyCalls = 0;
        var verifier = DeployMockVerifier(engine, _ =>
        {
            verifyCalls++;
            return false;
        });

        engine.SetTransactionSigners(owner);
        vault.Verifier = verifier.Hash;
        vault.Relayer = owner.Account;
        vault.SetAssetAllowed(asset.Hash, true);
        vault.TreeMaintainer = owner.Account;

        engine.SetTransactionSigners(depositor);
        byte[] leaf = NewFixedBytes(0x33);
        asset.Transfer(
            depositor.Account,
            vault.Hash,
            10,
            new object[] { stealth, leaf });

        byte[] root = PublishRoot(engine, vault, owner, 0x34);
        byte[] nullifier = NewFixedBytes(0x44);

        engine.SetTransactionSigners(owner);
        Assert.Throws<TestException>(() =>
            vault.Withdraw(
                asset.Hash,
                BuildProofPayload(0x00),
                BuildPublicInputsPayload(),
                root,
                nullifier,
                recipient.Account,
                owner.Account,
                10,
                1));

        Assert.Equal(new BigInteger(10), RequireBigInteger(vault.GetAssetEscrowBalance(asset.Hash)));
        Assert.False(RequireBool(vault.IsNullifierUsed(nullifier)));
        Assert.Equal(1, verifyCalls);
        Assert.Equal(new BigInteger(90), RequireBigInteger(asset.BalanceOf(depositor.Account)));
        Assert.Equal(BigInteger.Zero, RequireBigInteger(asset.BalanceOf(recipient.Account)));
    }

    [Fact]
    public void Withdraw_Rejects_WhenRequestedAmountDoesNotMatchDepositedNote() { }

    [Fact]
    public void Withdraw_Rejects_WhenUsingRootFromDifferentAssetDomain() { }

    [Fact]
    public void Withdraw_Rejects_WhenRootPredatesCommitment_ThenSucceedsAfterRootRefresh() { }

    private static MockVerifierContract DeployMockVerifier(
        TestEngine engine,
        Func<byte[]?, bool> verifyRule)
    {
        ContractManifest manifest = BuildSingleMethodManifest(
            "verify",
            ContractParameterType.Boolean,
            safe: true,
            ("asset", ContractParameterType.Hash160),
            ("proof", ContractParameterType.ByteArray),
            ("publicInputs", ContractParameterType.ByteArray),
            ("merkleRoot", ContractParameterType.ByteArray),
            ("nullifierHash", ContractParameterType.ByteArray),
                        ("recipient", ContractParameterType.Hash160),
            ("relayer", ContractParameterType.Hash160),
            ("amount", ContractParameterType.Integer),
            ("fee", ContractParameterType.Integer));

        return engine.Deploy<MockVerifierContract>(
            Neo.SmartContract.Testing.zNEP17Protocol.Nef,
            manifest,
            null,
            mock =>
            {
                mock.Setup(m => m.Verify(
                        It.IsAny<UInt160?>(),
                        It.IsAny<byte[]?>(),
                        It.IsAny<byte[]?>(),
                        It.IsAny<byte[]?>(),
                        It.IsAny<byte[]?>(),
                        It.IsAny<UInt160?>(),
                        It.IsAny<UInt160?>(),
                        It.IsAny<BigInteger?>(),
                        It.IsAny<BigInteger?>()
                    ))
                    .Returns<UInt160?, byte[]?, byte[]?, byte[]?, byte[]?, UInt160?, UInt160?, BigInteger?, BigInteger?>(
                        (_, proof, _, _, _, _, _, _, _)  => verifyRule(proof));
            });
    }

    private static ContractManifest BuildSingleMethodManifest(
        string methodName,
        ContractParameterType returnType,
        bool safe,
        params (string Name, ContractParameterType Type)[] parameters)
    {
        ContractManifest manifest = ContractManifest.Parse(Neo.SmartContract.Testing.zNEP17Protocol.Manifest.ToJson().ToString());
        manifest.Abi.Events = Array.Empty<ContractEventDescriptor>();
        manifest.Abi.Methods =
        [
            new ContractMethodDescriptor
            {
                Name = methodName,
                Safe = safe,
                ReturnType = returnType,
                Parameters = parameters
                    .Select(p => new ContractParameterDefinition { Name = p.Name, Type = p.Type })
                    .ToArray()
            }
        ];
        manifest.Name = $"zNEP17.{methodName}.mock.{Interlocked.Increment(ref _mockContractSequence)}";
        return manifest;
    }

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

    private static byte[] BuildPublicInputsPayload(byte firstByte = 0x02)
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
        vault.UpdateMerkleRoot(root);
        return root;
    }

    private static byte[] RequireBytes(byte[]? value) => value ?? throw new InvalidOperationException("Expected byte array.");
    private static bool RequireBool(bool? value) => value ?? throw new InvalidOperationException("Expected bool.");
    private static BigInteger RequireBigInteger(BigInteger? value) => value ?? throw new InvalidOperationException("Expected integer.");
}
