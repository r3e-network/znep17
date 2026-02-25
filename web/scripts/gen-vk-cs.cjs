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

  console.log("AlphaG1:\n" + formatBytes(compress(A, curve.G1)));
  console.log("BetaG2:\n" + formatBytes(compress(B, curve.G2)));
  console.log("GammaG2:\n" + formatBytes(compress(C, curve.G2)));
  console.log("DeltaG2:\n" + formatBytes(compress(D, curve.G2)));
  
  for(let i = 0; i < vk.IC.length; i++) {
     console.log(`IcG1[${i}]:\n` + formatBytes(compress(curve.G1.fromObject(unstringifyBigInts(vk.IC[i])), curve.G1)));
  }

  await curve.terminate();
  process.exit(0);
}
main().catch(console.error);
