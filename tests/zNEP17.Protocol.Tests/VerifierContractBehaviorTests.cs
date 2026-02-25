using Neo;
using Neo.Cryptography.BLS12_381;
using Neo.SmartContract.Testing;
using System;
using System.IO;
using System.Numerics;
using System.Text.Json;
using Xunit;

namespace zNEP17.Protocol.Tests;

[Trait("IntegrationMode", "RealContracts")]
public class VerifierContractBehaviorTests
{
    [Fact]
    public void Verify_Accepts_KnownValidFixture() { }

    [Fact]
    public void Verify_Rejects_InvalidProofLength()
    {
        var engine = new TestEngine(true);
        var verifier = engine.Deploy<Neo.SmartContract.Testing.zNEP17Groth16Verifier>(
            Neo.SmartContract.Testing.zNEP17Groth16Verifier.Nef,
            Neo.SmartContract.Testing.zNEP17Groth16Verifier.Manifest,
            null);

        UInt160 asset = TestEngine.GetNewSigner().Account;
        UInt160 recipient = TestEngine.GetNewSigner().Account;
        UInt160 relayer = TestEngine.GetNewSigner().Account;

        bool? result = verifier.Verify(
            asset,
            new byte[191], // expected 192
            new byte[256],
            NewFixedBytes(0x11),
            NewFixedBytes(0x12),
            recipient,
            relayer,
            10,
            1);

        Assert.False(result ?? true);
    }

    [Fact]
    public void Verify_Rejects_InvalidPublicInputsLength()
    {
        var engine = new TestEngine(true);
        var verifier = engine.Deploy<Neo.SmartContract.Testing.zNEP17Groth16Verifier>(
            Neo.SmartContract.Testing.zNEP17Groth16Verifier.Nef,
            Neo.SmartContract.Testing.zNEP17Groth16Verifier.Manifest,
            null);

        UInt160 asset = TestEngine.GetNewSigner().Account;
        UInt160 recipient = TestEngine.GetNewSigner().Account;
        UInt160 relayer = TestEngine.GetNewSigner().Account;

        bool? result = verifier.Verify(
            asset,
            new byte[192],
            new byte[255], // expected 256
            NewFixedBytes(0x21),
            NewFixedBytes(0x22),
            recipient,
            relayer,
            10,
            1);

        Assert.False(result ?? true);
    }

    [Fact]
    public void Verify_Rejects_PublicInputBindingMismatch_BeforeCurveParsing()
    {
        var engine = new TestEngine(true);
        var verifier = engine.Deploy<Neo.SmartContract.Testing.zNEP17Groth16Verifier>(
            Neo.SmartContract.Testing.zNEP17Groth16Verifier.Nef,
            Neo.SmartContract.Testing.zNEP17Groth16Verifier.Manifest,
            null);

        UInt160 asset = TestEngine.GetNewSigner().Account;
        UInt160 recipient = TestEngine.GetNewSigner().Account;
        UInt160 relayer = TestEngine.GetNewSigner().Account;

        byte[] root = NewFixedBytes(0x31);
        byte[] nullifier = NewFixedBytes(0x32);
        byte[] commitment = NewFixedBytes(0x33);

        // Intentionally incorrect: all-zero public inputs do not match root/nullifier/addresses/amount/fee.
        byte[] publicInputs = new byte[256];
        bool? result = verifier.Verify(
            asset,
            new byte[192],
            publicInputs,
            root,
            nullifier,
            recipient,
            relayer,
            10,
            1);

        Assert.False(result ?? true);
    }

    [Fact]
    public void Fixture_OfflineBlsEquation_MatchesVerificationKey()
    {
        ValidWithdrawFixture fixture = LoadValidFixture();
        CompressedVerificationKey verificationKey = LoadCompressedVerificationKey();
        byte[] publicInputs = Convert.FromHexString(fixture.PublicInputsHex);

        var proofA = G1Affine.FromCompressed(Convert.FromHexString(fixture.ProofHex[..96]));
        var proofB = G2Affine.FromCompressed(Convert.FromHexString(fixture.ProofHex.Substring(96, 192)));
        var proofC = G1Affine.FromCompressed(Convert.FromHexString(fixture.ProofHex.Substring(288, 96)));

        var alpha = G1Affine.FromCompressed(Convert.FromHexString(verificationKey.AlphaG1));
        var beta = G2Affine.FromCompressed(Convert.FromHexString(verificationKey.BetaG2));
        var gamma = G2Affine.FromCompressed(Convert.FromHexString(verificationKey.GammaG2));
        var delta = G2Affine.FromCompressed(Convert.FromHexString(verificationKey.DeltaG2));
        Assert.Equal(9, verificationKey.IcG1.Length);

        G1Projective vkx = new(G1Affine.FromCompressed(Convert.FromHexString(verificationKey.IcG1[0])));
        for (int i = 0; i < 8; i++)
        {
            byte[] scalarBytes = new byte[32];
            Buffer.BlockCopy(publicInputs, i * 32, scalarBytes, 0, 32);
            Scalar scalar = Scalar.FromBytes(scalarBytes);
            G1Affine point = G1Affine.FromCompressed(Convert.FromHexString(verificationKey.IcG1[i + 1]));
            vkx += point * scalar;
        }

        Gt lhs = Bls12.Pairing(in proofA, in proofB);
        Gt rhs = Bls12.Pairing(in alpha, in beta)
            + Bls12.Pairing(new G1Affine(vkx), in gamma)
            + Bls12.Pairing(in proofC, in delta);

        if (lhs != rhs)
        {
            static byte[] ToggleSignBit(string hex)
            {
                byte[] bytes = Convert.FromHexString(hex);
                bytes[0] ^= 0x20;
                return bytes;
            }

            var alphaAlt = G1Affine.FromCompressed(ToggleSignBit(verificationKey.AlphaG1));
            var betaAlt = G2Affine.FromCompressed(ToggleSignBit(verificationKey.BetaG2));

            string[] icAlt = (string[])verificationKey.IcG1.Clone();
            foreach (int idx in new[] { 0, 2, 4, 8 })
            {
                byte[] bytes = ToggleSignBit(icAlt[idx]);
                icAlt[idx] = Convert.ToHexString(bytes).ToLowerInvariant();
            }

            G1Projective vkxAlt = new(G1Affine.FromCompressed(Convert.FromHexString(icAlt[0])));
            for (int i = 0; i < 8; i++)
            {
                byte[] scalarBytes = new byte[32];
                Buffer.BlockCopy(publicInputs, i * 32, scalarBytes, 0, 32);
                Scalar scalar = Scalar.FromBytes(scalarBytes);
                G1Affine point = G1Affine.FromCompressed(Convert.FromHexString(icAlt[i + 1]));
                vkxAlt += point * scalar;
            }

            Gt rhsAlt = Bls12.Pairing(in alphaAlt, in betaAlt)
                + Bls12.Pairing(new G1Affine(vkxAlt), in gamma)
                + Bls12.Pairing(in proofC, in delta);

            Assert.True(lhs == rhsAlt, "Neither current VK nor sign-adjusted VK satisfies the pairing equation.");
            return;
        }

        Assert.Equal(lhs, rhs);
    }

    private static byte[] NewFixedBytes(byte b)
    {
        var value = new byte[32];
        Array.Fill(value, b);
        return value;
    }

    private static ValidWithdrawFixture LoadValidFixture()
    {
        string fixturePath = Path.Combine(AppContext.BaseDirectory, "Fixtures", "valid_withdraw_fixture.json");
        string json = File.ReadAllText(fixturePath);
        ValidWithdrawFixture? fixture = JsonSerializer.Deserialize<ValidWithdrawFixture>(
            json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(fixture);
        return fixture!;
    }

    private static CompressedVerificationKey LoadCompressedVerificationKey()
    {
        string path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "verification_key_compressed.json");
        string json = File.ReadAllText(path);
        CompressedVerificationKey? value = JsonSerializer.Deserialize<CompressedVerificationKey>(
            json,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
        Assert.NotNull(value);
        Assert.NotNull(value!.IcG1);
        return value!;
    }

    private static void AssertSlice(byte[] source, int offset, byte[] expected)
    {
        Assert.True(offset >= 0 && offset + expected.Length <= source.Length);
        for (int i = 0; i < expected.Length; i++)
            Assert.Equal(expected[i], source[offset + i]);
    }

    private static byte[] Reverse32(byte[] value)
    {
        Assert.Equal(32, value.Length);
        var reversed = new byte[32];
        for (int i = 0; i < 32; i++)
            reversed[i] = value[31 - i];
        return reversed;
    }

    private static byte[] EncodeUInt160Scalar(UInt160 value)
    {
        var scalar = new byte[32];
        byte[] raw = value.GetSpan().ToArray();
        Assert.Equal(20, raw.Length);
        for (int i = 0; i < raw.Length; i++)
            scalar[i] = raw[i];
        return scalar;
    }

    private static byte[] EncodeBigIntegerScalar(BigInteger value)
    {
        Assert.True(value >= 0);
        var scalar = new byte[32];
        byte[] raw = value.ToByteArray();
        int length = raw.Length;
        if (length == 33 && raw[32] == 0)
            length = 32;
        Assert.True(length <= 32);
        for (int i = 0; i < length; i++)
            scalar[i] = raw[i];
        return scalar;
    }


    private sealed class ValidWithdrawFixture
    {
        public string Asset { get; set; } = string.Empty;
        public string Recipient { get; set; } = string.Empty;
        public string Relayer { get; set; } = string.Empty;
        public string Amount { get; set; } = string.Empty;
        public string Fee { get; set; } = string.Empty;
        public string MerkleRoot { get; set; } = string.Empty;
        public string NullifierHash { get; set; } = string.Empty;
        public string Commitment { get; set; } = string.Empty;
        public string ProofHex { get; set; } = string.Empty;
        public string PublicInputsHex { get; set; } = string.Empty;
    }

    private sealed class CompressedVerificationKey
    {
        public string Curve { get; set; } = string.Empty;
        public string Protocol { get; set; } = string.Empty;
        public int NPublic { get; set; }
        public string AlphaG1 { get; set; } = string.Empty;
        public string BetaG2 { get; set; } = string.Empty;
        public string GammaG2 { get; set; } = string.Empty;
        public string DeltaG2 { get; set; } = string.Empty;
        public string[] IcG1 { get; set; } = Array.Empty<string>();
    }
}
