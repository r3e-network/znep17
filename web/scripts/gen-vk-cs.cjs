const fs = require('fs');
const path = require('path');
const ffjavascript = require('ffjavascript');
const { unstringifyBigInts } = ffjavascript.utils;

const COMPRESSED_FLAG = 0x80;
const INFINITY_FLAG = 0x40;
const SIGN_FLAG = 0x20;

function convertFfCompressedToNeo(bytes) {
  const output = Uint8Array.from(bytes);
  const ffSign = (output[0] & COMPRESSED_FLAG) !== 0;
  const ffInfinity = (output[0] & INFINITY_FLAG) !== 0;
  output[0] &= 0x1f;
  output[0] |= COMPRESSED_FLAG;
  if (ffInfinity) output[0] |= INFINITY_FLAG;
  if (ffSign) output[0] |= SIGN_FLAG;
  return output;
}

async function main() {
  const vkPath = path.resolve(__dirname, '../../circuits/verification_key.json');
  const vk = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
  const curve = await ffjavascript.getCurveFromName('bls12381');

  function compress(P, G) {
      const out = new Uint8Array(G === curve.G1 ? 48 : 96);
      G.toRprCompressed(out, 0, P);
      return convertFfCompressedToNeo(out);
  }

  function formatBytes(arr) {
    let out = "        ";
    for(let i = 0; i < arr.length; i++) {
        out += "0x" + arr[i].toString(16).padStart(2, '0') + ", ";
        if ((i + 1) % 12 === 0 && i !== arr.length - 1) {
            out += "\n        ";
        }
    }
    return out.replace(/, $/, '');
  }

  const A = curve.G1.fromObject(unstringifyBigInts(vk.vk_alpha_1));
  const B = curve.G2.fromObject(unstringifyBigInts(vk.vk_beta_2));
  const C = curve.G2.fromObject(unstringifyBigInts(vk.vk_gamma_2));
  const D = curve.G2.fromObject(unstringifyBigInts(vk.vk_delta_2));

  let csContent = `namespace zNEP17.Verifier;

internal static class VerificationKeyBls12381
{
    public const int PublicInputCount = ${vk.IC.length - 1};
    public const int ScalarLength = 32;
    public const int ProofLength = 192; // A(48) | B(96) | C(48)
    public const int PublicInputsLength = PublicInputCount * ScalarLength;
    public const int G1CompressedLength = 48;
    public const int G2CompressedLength = 96;

    public static readonly byte[] AlphaG1 = new byte[]
    {
${formatBytes(compress(A, curve.G1))}
    };

    public static readonly byte[] BetaG2 = new byte[]
    {
${formatBytes(compress(B, curve.G2))}
    };

    public static readonly byte[] GammaG2 = new byte[]
    {
${formatBytes(compress(C, curve.G2))}
    };

    public static readonly byte[] DeltaG2 = new byte[]
    {
${formatBytes(compress(D, curve.G2))}
    };

    public static readonly byte[][] IcG1 = new byte[][]
    {
`;

  for(let i = 0; i < vk.IC.length; i++) {
     csContent += `        new byte[]\n        {\n${formatBytes(compress(curve.G1.fromObject(unstringifyBigInts(vk.IC[i])), curve.G1))}\n        }`;
     if (i < vk.IC.length - 1) csContent += ",\n";
     else csContent += "\n";
  }

  csContent += `    };\n}\n`;

  fs.writeFileSync(path.resolve(__dirname, '../../src/zNEP17.Verifier/VerificationKey.Bls12381.cs'), csContent);
  await curve.terminate();
}
main().catch(console.error);
