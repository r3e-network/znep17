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
            amount: 100,
            fee: 1,
            rootLength: 31,
            nullifierLength: PrivacyGuards.NullifierLength,
            proofLength: PrivacyGuards.Groth16ProofLength,
            publicInputsLength: PrivacyGuards.Groth16PublicInputsLength);

        bool invalidNullifier = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: true,
            amount: 100,
            fee: 1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: 16,
            proofLength: PrivacyGuards.Groth16ProofLength,
            publicInputsLength: PrivacyGuards.Groth16PublicInputsLength);

        Assert.False(invalidRoot);
        Assert.False(invalidNullifier);
    }

    [Fact]
    public void WithdrawValidation_Rejects_WrongCommitmentLength()
    {
        bool invalidCommitment = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: true,
            amount: 100,
            fee: 1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
            proofLength: PrivacyGuards.Groth16ProofLength,
            publicInputsLength: PrivacyGuards.Groth16PublicInputsLength);

        Assert.False(invalidCommitment);
    }

    [Fact]
    public void WithdrawValidation_Rejects_InvalidAmountFeeRelation()
    {
        bool invalidEqual = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: true,
            amount: 10,
            fee: 10,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
            proofLength: PrivacyGuards.Groth16ProofLength,
            publicInputsLength: PrivacyGuards.Groth16PublicInputsLength);

        bool invalidNegativeFee = PrivacyGuards.IsValidWithdrawRequest(
            isAssetValid: true,
            isRecipientValid: true,
            isRelayerValid: true,
            amount: 10,
            fee: -1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
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
            amount: 10,
            fee: 0,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
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
            amount: 10,
            fee: 1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
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
            amount: 10,
            fee: 1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
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
            amount: 10,
            fee: 1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
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
            amount: 10,
            fee: 1,
            rootLength: PrivacyGuards.MerkleRootLength,
            nullifierLength: PrivacyGuards.NullifierLength,
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
    {
            isAssetValid: false,
            isRecipientValid: true,
            amount: 10,
            commitmentLength: PrivacyGuards.LeafLength);

        Assert.False(valid);
    }

    [Fact]
    {
            isAssetValid: true,
            isRecipientValid: false,
            amount: 10,
            commitmentLength: PrivacyGuards.LeafLength);

        Assert.False(valid);
    }

    [Fact]
    {
            isAssetValid: true,
            isRecipientValid: true,
            amount: 0,
            commitmentLength: PrivacyGuards.LeafLength);

            isAssetValid: true,
            isRecipientValid: true,
            amount: -1,
            commitmentLength: PrivacyGuards.LeafLength);

        Assert.False(zero);
        Assert.False(negative);
    }

    [Fact]
    {
            isAssetValid: true,
            isRecipientValid: true,
            amount: 10,
            commitmentLength: 16);

        Assert.False(valid);
    }

    [Fact]
    {
            isAssetValid: true,
            isRecipientValid: true,
            amount: 10,
            commitmentLength: PrivacyGuards.LeafLength);

        Assert.True(valid);
    }
}
