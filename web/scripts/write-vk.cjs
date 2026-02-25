const fs = require('fs');

const data = fs.readFileSync('../new-vkey.txt', 'utf8');

const output = `namespace zNEP17.Verifier;

internal static class VerificationKeyBls12381
{
    public const int PublicInputCount = 7;
    public const int ScalarLength = 32;
    public const int ProofLength = 192; // A(48) | B(96) | C(48)
    public const int PublicInputsLength = PublicInputCount * ScalarLength;
    public const int G1CompressedLength = 48;
    public const int G2CompressedLength = 96;

    public static readonly byte[] AlphaG1 = new byte[]
    {
${data.split('AlphaG1:\n')[1].split('\nBetaG2:')[0]}
    };

    public static readonly byte[] BetaG2 = new byte[]
    {
${data.split('BetaG2:\n')[1].split('\nGammaG2:')[0]}
    };

    public static readonly byte[] GammaG2 = new byte[]
    {
${data.split('GammaG2:\n')[1].split('\nDeltaG2:')[0]}
    };

    public static readonly byte[] DeltaG2 = new byte[]
    {
${data.split('DeltaG2:\n')[1].split('\nIcG1[0]:')[0]}
    };

    public static readonly byte[][] IcG1 = new byte[][]
    {
        new byte[]
        {
${data.split('IcG1[0]:\n')[1].split('\nIcG1[1]:')[0]}
        },
        new byte[]
        {
${data.split('IcG1[1]:\n')[1].split('\nIcG1[2]:')[0]}
        },
        new byte[]
        {
${data.split('IcG1[2]:\n')[1].split('\nIcG1[3]:')[0]}
        },
        new byte[]
        {
${data.split('IcG1[3]:\n')[1].split('\nIcG1[4]:')[0]}
        },
        new byte[]
        {
${data.split('IcG1[4]:\n')[1].split('\nIcG1[5]:')[0]}
        },
        new byte[]
        {
${data.split('IcG1[5]:\n')[1].split('\nIcG1[6]:')[0]}
        },
        new byte[]
        {
${data.split('IcG1[6]:\n')[1].split('\nIcG1[7]:')[0]}
        },
        new byte[]
        {
${data.split('IcG1[7]:\n')[1]}
        }
    };
}
`;

fs.writeFileSync('../../src/zNEP17.Verifier/VerificationKey.Bls12381.cs', output);
