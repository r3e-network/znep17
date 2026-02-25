using System;
using System.Numerics;

namespace zNEP17.Protocol;

public static class PrivacyGuards
{
    public const int LeafLength = 32;
    public const int MerkleRootLength = 32;
    public const int NullifierLength = 32;
    public const int Groth16ProofLength = 192; // A(48) | B(96) | C(48)
    public const int Groth16PublicInputsLength = 256; // 8 field elements x 32-byte LE scalar
    public const int MaxProofPayloadLength = Groth16ProofLength;
    public const int MaxPublicInputsPayloadLength = Groth16PublicInputsLength;
    public const int MaxStoredLeaves = 64;
    public const int MaxRootHistoryEntries = 64;
    public const int TreeDepth = 20;
    public const int MaxLeafIndex = 1 << TreeDepth; // 1_048_576
    public const uint ConfigUpdateDelaySeconds = 86400; // 24 hours
    public const uint EmergencyWithdrawDelaySeconds = 604800; // 7 days
    public const uint SecurityCouncilUpdateDelaySeconds = 172800; // 48 hours

    public static bool IsValidDepositRequest(
        bool isAssetValid,
        bool isStealthAddressValid,
        BigInteger amount,
        int leafLength)
    {
        return isAssetValid
            && isStealthAddressValid
            && amount > 0
            && leafLength == LeafLength;
    }

    public static bool IsValidWithdrawRequest(
        bool isAssetValid,
        bool isRecipientValid,
        bool isRelayerValid,
        BigInteger amount,
        BigInteger fee,
        int rootLength,
        int nullifierLength,
        int proofLength,
        int publicInputsLength)
    {
        bool hasValidRelayerIfNeeded = fee == 0 || isRelayerValid;

        return isAssetValid
            && isRecipientValid
            && hasValidRelayerIfNeeded
            && amount > 0
            && fee >= 0
            && amount > fee
            && rootLength == MerkleRootLength
            && nullifierLength == NullifierLength
            && proofLength == Groth16ProofLength
            && publicInputsLength == Groth16PublicInputsLength;
    }

    public static bool IsValidEmergencyWithdrawRequest(
        bool isAssetValid,
        bool isRecipientValid,
        BigInteger amount)
    {
        return isAssetValid
            && isRecipientValid
            && amount > 0
            ;
    }

    public static BigInteger CalculateRecipientPayout(BigInteger amount, BigInteger fee)
    {
        if (amount <= 0)
            throw new ArgumentOutOfRangeException(nameof(amount));
        if (fee < 0)
            throw new ArgumentOutOfRangeException(nameof(fee));
        if (amount <= fee)
            throw new ArgumentOutOfRangeException(nameof(fee));

        return amount - fee;
    }
}
