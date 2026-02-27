using Neo;
using Neo.SmartContract.Framework;
using Neo.SmartContract.Framework.Attributes;
using Neo.SmartContract.Framework.Native;
using System.ComponentModel;
using System.Numerics;

namespace zNEP17.Verifier;

[ManifestExtra("Author", "R3E Network")]
[ManifestExtra("Description", "zNEP-17 production Groth16 verifier over BLS12-381 on Neo N3.")]
[ManifestExtra("Version", "1.0.0")]
[DisplayName("zNEP17Groth16Verifier")]
public class zNEP17Groth16Verifier : SmartContract
{
    [Safe]
    public static bool Verify(
        UInt160 asset,
        byte[] proof,
        byte[] publicInputs,
        byte[] merkleRoot,
        byte[] nullifierHash,
        byte[] newCommitment,
        UInt160 recipient,
        UInt160 relayer,
        BigInteger amountWithdraw,
        BigInteger fee)
    {
        if (!asset.IsValidAndNotZero || !recipient.IsValidAndNotZero || !relayer.IsValidAndNotZero)
            return false;
        if (proof is null || proof.Length != VerificationKeyBls12381.ProofLength)
            return false;
        if (publicInputs is null || publicInputs.Length != VerificationKeyBls12381.PublicInputsLength)
            return false;
        if (merkleRoot is null || merkleRoot.Length != 32)
            return false;
        if (nullifierHash is null || nullifierHash.Length != 32)
            return false;
        if (newCommitment is null || newCommitment.Length != 32)
            return false;
        if (amountWithdraw <= 0 || fee < 0 || amountWithdraw <= fee)
            return false;

        if (!ValidatePublicInputs(publicInputs, merkleRoot, nullifierHash, recipient, relayer, amountWithdraw, fee, asset, newCommitment))
            return false;

        byte[] proofABytes = Slice(proof, 0, VerificationKeyBls12381.G1CompressedLength);
        byte[] proofBBytes = Slice(proof, VerificationKeyBls12381.G1CompressedLength, VerificationKeyBls12381.G2CompressedLength);
        byte[] proofCBytes = Slice(
            proof,
            VerificationKeyBls12381.G1CompressedLength + VerificationKeyBls12381.G2CompressedLength,
            VerificationKeyBls12381.G1CompressedLength);

        object proofA = CryptoLib.Bls12381Deserialize(proofABytes);
        object proofB = CryptoLib.Bls12381Deserialize(proofBBytes);
        object proofC = CryptoLib.Bls12381Deserialize(proofCBytes);

        object alpha = CryptoLib.Bls12381Deserialize(VerificationKeyBls12381.AlphaG1);
        object beta = CryptoLib.Bls12381Deserialize(VerificationKeyBls12381.BetaG2);
        object gamma = CryptoLib.Bls12381Deserialize(VerificationKeyBls12381.GammaG2);
        object delta = CryptoLib.Bls12381Deserialize(VerificationKeyBls12381.DeltaG2);
        object vkx = BuildLinearCombination(publicInputs);

        object lhs = CryptoLib.Bls12381Pairing(proofA, proofB);
        object rhs = CryptoLib.Bls12381Pairing(alpha, beta);
        rhs = CryptoLib.Bls12381Add(rhs, CryptoLib.Bls12381Pairing(vkx, gamma));
        rhs = CryptoLib.Bls12381Add(rhs, CryptoLib.Bls12381Pairing(proofC, delta));

        bool ok = CryptoLib.Bls12381Equal(lhs, rhs); if (!ok) ExecutionEngine.Assert(false, "Pairing returned FALSE"); return ok;
    }

    private static object BuildLinearCombination(byte[] publicInputs)
    {
        object acc = CryptoLib.Bls12381Deserialize(VerificationKeyBls12381.IcG1[0]);
        for (int i = 0; i < VerificationKeyBls12381.PublicInputCount; i++)
        {
            byte[] scalar = Slice(
                publicInputs,
                i * VerificationKeyBls12381.ScalarLength,
                VerificationKeyBls12381.ScalarLength);

            object point = CryptoLib.Bls12381Deserialize(VerificationKeyBls12381.IcG1[i + 1]);
            object term = CryptoLib.Bls12381Mul(point, scalar, false);
            acc = CryptoLib.Bls12381Add(acc, term);
        }

        return acc;
    }

    private static bool ValidatePublicInputs(
        byte[] publicInputs,
        byte[] merkleRoot,
        byte[] nullifierHash,
        UInt160 recipient,
        UInt160 relayer,
        BigInteger amountWithdraw,
        BigInteger fee,
        UInt160 asset,
        byte[] newCommitment)
    {
        if (!SliceEquals(publicInputs, 0 * VerificationKeyBls12381.ScalarLength, Reverse32(merkleRoot))) return false;
        if (!SliceEquals(publicInputs, 1 * VerificationKeyBls12381.ScalarLength, Reverse32(nullifierHash))) return false;

        byte[] recipientScalar = new byte[32];
        if (!TryEncodeUInt160Scalar(recipient, out recipientScalar)) return false;
        if (!SliceEquals(publicInputs, 2 * VerificationKeyBls12381.ScalarLength, recipientScalar)) return false;

        byte[] relayerScalar = new byte[32];
        if (!TryEncodeUInt160Scalar(relayer, out relayerScalar)) return false;
        if (!SliceEquals(publicInputs, 3 * VerificationKeyBls12381.ScalarLength, relayerScalar)) return false;

        byte[] feeScalar = new byte[32];
        if (!TryEncodeBigIntegerScalar(fee, out feeScalar)) return false;
        if (!SliceEquals(publicInputs, 4 * VerificationKeyBls12381.ScalarLength, feeScalar)) return false;

        byte[] assetScalar = new byte[32];
        if (!TryEncodeUInt160Scalar(asset, out assetScalar)) return false;
        if (!SliceEquals(publicInputs, 5 * VerificationKeyBls12381.ScalarLength, assetScalar)) return false;

        byte[] amountWithdrawScalar = new byte[32];
        if (!TryEncodeBigIntegerScalar(amountWithdraw, out amountWithdrawScalar)) return false;
        if (!SliceEquals(publicInputs, 6 * VerificationKeyBls12381.ScalarLength, amountWithdrawScalar)) return false;

        if (!SliceEquals(publicInputs, 7 * VerificationKeyBls12381.ScalarLength, Reverse32(newCommitment))) return false;

        return true;
    }

    private static bool TryEncodeBigIntegerScalar(BigInteger value, out byte[] scalar)
    {
        scalar = new byte[VerificationKeyBls12381.ScalarLength];
        if (value < 0)
            return false;

        byte[] raw = value.ToByteArray();
        int length = raw.Length;
        if (length > VerificationKeyBls12381.ScalarLength)
        {
            if (length == VerificationKeyBls12381.ScalarLength + 1 && raw[length - 1] == 0)
            {
                length = VerificationKeyBls12381.ScalarLength;
            }
            else
            {
                return false;
            }
        }

        for (int i = 0; i < length; i++)
            scalar[i] = raw[i];

        return true;
    }

    private static bool TryEncodeUInt160Scalar(UInt160 value, out byte[] scalar)
    {
        scalar = new byte[VerificationKeyBls12381.ScalarLength];
        byte[] raw = (byte[])value;
        if (raw.Length != 20)
            return false;

        for (int i = 0; i < raw.Length; i++)
            scalar[i] = raw[i];

        return true;
    }

    private static byte[] Reverse32(byte[] value)
    {
        byte[] scalar = new byte[VerificationKeyBls12381.ScalarLength];
        for (int i = 0; i < VerificationKeyBls12381.ScalarLength; i++)
            scalar[i] = value[VerificationKeyBls12381.ScalarLength - 1 - i];

        return scalar;
    }

    private static bool SliceEquals(byte[] source, int offset, byte[] expected)
    {
        if (offset < 0)
            return false;
        if (offset + expected.Length > source.Length)
            return false;

        for (int i = 0; i < expected.Length; i++)
        {
            if (source[offset + i] != expected[i])
                return false;
        }

        return true;
    }

    private static byte[] Slice(byte[] source, int offset, int length)
    {
        byte[] part = new byte[length];
        for (int i = 0; i < length; i++)
            part[i] = source[offset + i];

        return part;
    }
}
