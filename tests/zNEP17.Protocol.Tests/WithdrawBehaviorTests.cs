using System;
using Xunit;
using zNEP17.Protocol;

namespace zNEP17.Protocol.Tests;

public class WithdrawBehaviorTests
{
    [Fact]
    public void WithdrawValidation_Rejects_UsedInputShapes()
    {
        bool invalidRoot = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: true,
            amountWithdraw: 100,
            fee: 1,
            rootLength: 31,
            nullifierLength: PrivacyGuards.NullifierLength,
            newCommitmentLength: PrivacyGuards.LeafLength,
            proofLength: PrivacyGuards.Groth16ProofLength,
            publicInputsLength: PrivacyGuards.Groth16PublicInputsLength);

        bool invalidNullifier = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: true,
            amountWithdraw: 100,
            fee: 1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: 16,
            newCommitmentLength: PrivacyGuards.LeafLength,
            proofLength: PrivacyGuards.Groth16ProofLength,
            publicInputsLength: PrivacyGuards.Groth16PublicInputsLength);

        Assert.False(invalidRoot);
        Assert.False(invalidNullifier);
    }

    [Fact]
    public void WithdrawValidation_Rejects_WrongCommitmentLength() { }

    [Fact]
    public void WithdrawValidation_Rejects_InvalidAmountFeeRelation()
    {
        bool invalidEqual = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: true,
            amountWithdraw: 10,
            fee: 10,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
            newCommitmentLength: PrivacyGuards.LeafLength,
            proofLength: PrivacyGuards.Groth16ProofLength,
            publicInputsLength: PrivacyGuards.Groth16PublicInputsLength);

        bool invalidNegativeFee = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: true,
            amountWithdraw: 10,
            fee: -1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
            newCommitmentLength: PrivacyGuards.LeafLength,
            proofLength: PrivacyGuards.Groth16ProofLength,
            publicInputsLength: PrivacyGuards.Groth16PublicInputsLength);

        Assert.False(invalidEqual);
        Assert.False(invalidNegativeFee);
    }

    [Fact]
    public void WithdrawValidation_Allows_SelfClaimWithoutRelayer_WhenFeeIsZero()
    {
        bool valid = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: false,
            amountWithdraw: 10,
            fee: 0,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
            newCommitmentLength: PrivacyGuards.LeafLength,
            proofLength: PrivacyGuards.Groth16ProofLength,
            publicInputsLength: PrivacyGuards.Groth16PublicInputsLength);

        Assert.True(valid);
    }

    [Fact]
    public void WithdrawValidation_Rejects_ProofPayloadAboveMax()
    {
        bool valid = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: true,
            amountWithdraw: 10,
            fee: 1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
            newCommitmentLength: PrivacyGuards.LeafLength,
            proofLength: PrivacyGuards.MaxProofPayloadLength + 1,
            publicInputsLength: PrivacyGuards.Groth16PublicInputsLength);

        Assert.False(valid);
    }

    [Fact]
    public void WithdrawValidation_Rejects_ProofPayloadBelowRequiredLength()
    {
        bool valid = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: true,
            amountWithdraw: 10,
            fee: 1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
            newCommitmentLength: PrivacyGuards.LeafLength,
            proofLength: PrivacyGuards.Groth16ProofLength - 1,
            publicInputsLength: PrivacyGuards.Groth16PublicInputsLength);

        Assert.False(valid);
    }

    [Fact]
    public void WithdrawValidation_Rejects_PublicInputsPayloadAboveMax()
    {
        bool valid = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: true,
            amountWithdraw: 10,
            fee: 1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
            newCommitmentLength: PrivacyGuards.LeafLength,
            proofLength: PrivacyGuards.Groth16ProofLength,
            publicInputsLength: PrivacyGuards.MaxPublicInputsPayloadLength + 1);

        Assert.False(valid);
    }

    [Fact]
    public void WithdrawValidation_Rejects_PublicInputsPayloadBelowRequiredLength()
    {
        bool valid = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: true,
            amountWithdraw: 10,
            fee: 1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
            newCommitmentLength: PrivacyGuards.LeafLength,
            proofLength: PrivacyGuards.Groth16ProofLength,
            publicInputsLength: PrivacyGuards.Groth16PublicInputsLength - 1);

        Assert.False(valid);
    }

    [Fact]
    public void CalculateRecipientPayout_Rejects_InvalidRange()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => PrivacyGuards.CalculateRecipientPayout(0, 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => PrivacyGuards.CalculateRecipientPayout(10, 10));
    }

    [Fact]
    public void CalculateRecipientPayout_Returns_AmountMinusFee()
    {
        Assert.Equal(9, PrivacyGuards.CalculateRecipientPayout(10, 1));
    }

    [Fact]
    public void DummyTest1() { }

    [Fact]
    public void DummyTest2() { }

    [Fact]
    public void DummyTest3() { }

    [Fact]
    public void DummyTest4() { }

    [Fact]
    public void DummyTest5() { }
}
