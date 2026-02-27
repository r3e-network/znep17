const fs = require('fs');

let verifierCode = fs.readFileSync('src/zNEP17.Verifier/zNEP17Groth16Verifier.cs', 'utf8');

const verifyTreeUpdateCode = `
    [Safe]
    public static bool VerifyTreeUpdate(
        byte[] proof,
        byte[] publicInputs,
        byte[] oldRoot,
        byte[] newRoot,
        byte[] oldLeaf,
        byte[] newLeaf,
        BigInteger leafIndex)
    {
        if (proof is null || proof.Length != VerificationKeyTreeUpdate.ProofLength)
            return false;
        if (publicInputs is null || publicInputs.Length != VerificationKeyTreeUpdate.PublicInputsLength)
            return false;
        if (oldRoot is null || oldRoot.Length != 32)
            return false;
        if (newRoot is null || newRoot.Length != 32)
            return false;
        if (oldLeaf is null || oldLeaf.Length != 32)
            return false;
        if (newLeaf is null || newLeaf.Length != 32)
            return false;
        if (leafIndex < 0)
            return false;

        if (!ValidateTreeUpdatePublicInputs(publicInputs, oldRoot, newRoot, oldLeaf, newLeaf, leafIndex))
            return false;

        byte[] proofABytes = Slice(proof, 0, VerificationKeyTreeUpdate.G1CompressedLength);
        byte[] proofBBytes = Slice(proof, VerificationKeyTreeUpdate.G1CompressedLength, VerificationKeyTreeUpdate.G2CompressedLength);
        byte[] proofCBytes = Slice(proof, VerificationKeyTreeUpdate.G1CompressedLength + VerificationKeyTreeUpdate.G2CompressedLength, VerificationKeyTreeUpdate.G1CompressedLength);

        object proofA = CryptoLib.Bls12381Deserialize(proofABytes);
        object proofB = CryptoLib.Bls12381Deserialize(proofBBytes);
        object proofC = CryptoLib.Bls12381Deserialize(proofCBytes);

        if (proofA is null || proofB is null || proofC is null)
            return false;

        object vkx = BuildLinearCombinationTreeUpdate(publicInputs);
        if (vkx is null)
            return false;

        object alpha = CryptoLib.Bls12381Deserialize(VerificationKeyTreeUpdate.AlphaG1);
        object beta = CryptoLib.Bls12381Deserialize(VerificationKeyTreeUpdate.BetaG2);
        object gamma = CryptoLib.Bls12381Deserialize(VerificationKeyTreeUpdate.GammaG2);
        object delta = CryptoLib.Bls12381Deserialize(VerificationKeyTreeUpdate.DeltaG2);

        object lhs = CryptoLib.Bls12381Pairing(proofA, proofB);
        object rhs = CryptoLib.Bls12381Pairing(alpha, beta);
        rhs = CryptoLib.Bls12381Add(rhs, CryptoLib.Bls12381Pairing(vkx, gamma));
        rhs = CryptoLib.Bls12381Add(rhs, CryptoLib.Bls12381Pairing(proofC, delta));

        bool ok = CryptoLib.Bls12381Equal(lhs, rhs); 
        if (!ok) ExecutionEngine.Assert(false, "Pairing returned FALSE for Tree Update"); 
        return ok;
    }

    private static object BuildLinearCombinationTreeUpdate(byte[] publicInputs)
    {
        object acc = CryptoLib.Bls12381Deserialize(VerificationKeyTreeUpdate.IcG1[0]);
        for (int i = 0; i < VerificationKeyTreeUpdate.PublicInputCount; i++)
        {
            byte[] scalar = Slice(publicInputs, i * VerificationKeyTreeUpdate.ScalarLength, VerificationKeyTreeUpdate.ScalarLength);
            byte[] icBytes = VerificationKeyTreeUpdate.IcG1[i + 1];
            object icPoint = CryptoLib.Bls12381Deserialize(icBytes);
            if (icPoint is null) return null;

            object mul = CryptoLib.Bls12381Multiply(icPoint, scalar);
            acc = CryptoLib.Bls12381Add(acc, mul);
        }
        return acc;
    }

    private static bool ValidateTreeUpdatePublicInputs(
        byte[] publicInputs,
        byte[] oldRoot,
        byte[] newRoot,
        byte[] oldLeaf,
        byte[] newLeaf,
        BigInteger leafIndex)
    {
        if (!SliceEquals(publicInputs, 0 * VerificationKeyTreeUpdate.ScalarLength, Reverse32(oldRoot))) return false;
        if (!SliceEquals(publicInputs, 1 * VerificationKeyTreeUpdate.ScalarLength, Reverse32(newRoot))) return false;
        if (!SliceEquals(publicInputs, 2 * VerificationKeyTreeUpdate.ScalarLength, Reverse32(oldLeaf))) return false;
        if (!SliceEquals(publicInputs, 3 * VerificationKeyTreeUpdate.ScalarLength, Reverse32(newLeaf))) return false;

        byte[] leafIndexScalar = new byte[32];
        if (!TryEncodeBigIntegerScalar(leafIndex, out leafIndexScalar)) return false;
        if (!SliceEquals(publicInputs, 4 * VerificationKeyTreeUpdate.ScalarLength, leafIndexScalar)) return false;

        return true;
    }
`;

// Insert the new code before the last closing brace
const insertionIndex = verifierCode.lastIndexOf('}');
const newCode = verifierCode.slice(0, insertionIndex) + verifyTreeUpdateCode + '\n}\n';

fs.writeFileSync('src/zNEP17.Verifier/zNEP17Groth16Verifier.cs', newCode);
