import * as fs from 'fs';
import * as path from 'path';
import { getBlsCurve, convertFfCompressedToNeo, unstringifyBigInts } from '../app/api/relay/zk-encoding';

async function main() {
  const vkPath = path.resolve(__dirname, '../../circuits/verification_key.json');
  const vkRaw = JSON.parse(fs.readFileSync(vkPath, 'utf8'));
  const vk = unstringifyBigInts(vkRaw);
  const curve = await getBlsCurve();

  function compressG1(p: any) {
    const P = curve.G1.fromObject(p);
    const encoded = new Uint8Array(48);
    curve.G1.toRprCompressed(encoded, 0, P);
    return convertFfCompressedToNeo(encoded);
  }

  function compressG2(p: any) {
    const P = curve.G2.fromObject(p);
    const encoded = new Uint8Array(96);
    curve.G2.toRprCompressed(encoded, 0, P);
    return convertFfCompressedToNeo(encoded);
  }

  function formatBytes(arr: Uint8Array) {
    let out = "        ";
    for(let i = 0; i < arr.length; i++) {
        out += "0x" + arr[i].toString(16).padStart(2, '0') + ", ";
        if ((i + 1) % 12 === 0 && i !== arr.length - 1) {
            out += "\n        ";
        }
    }
    return out.replace(/, $/, '');
  }

  console.log("AlphaG1:\n" + formatBytes(compressG1(vk.vk_alpha_1)));
  console.log("BetaG2:\n" + formatBytes(compressG2(vk.vk_beta_2)));
  console.log("GammaG2:\n" + formatBytes(compressG2(vk.vk_gamma_2)));
  console.log("DeltaG2:\n" + formatBytes(compressG2(vk.vk_delta_2)));
  
  for(let i = 0; i < vk.IC.length; i++) {
     console.log(`IcG1[${i}]:\n` + formatBytes(compressG1(vk.IC[i])));
  }

  process.exit(0);
}
main().catch(console.error);
