import { getCurveFromName } from "ffjavascript";
import type { Groth16Proof, PublicSignals } from "snarkjs";

const SCALAR_BYTES = 32;
const PUBLIC_INPUT_COUNT = 7;
const HASH160_HEX_RE = /^(?:0x)?[0-9a-fA-F]{40}$/;
const COMPRESSED_FLAG = 0x80;
const INFINITY_FLAG = 0x40;
const SIGN_FLAG = 0x20;

export const GROTH16_PROOF_PACKED_BYTES = 192;
export const GROTH16_PUBLIC_INPUTS_PACKED_BYTES = 224;

type BlsGroup = {
  fromObject(point: unknown): unknown;
  isValid(point: unknown): boolean;
  toRprCompressed(output: Uint8Array, offset: number, point: unknown): void;
};

type BlsCurve = {
  G1: BlsGroup;
  G2: BlsGroup;
};

let cachedBlsCurvePromise: Promise<BlsCurve> | null = null;

function isIntegerLikeString(value: string): boolean {
  return /^-?[0-9]+$/.test(value) || /^-?0x[0-9a-fA-F]+$/.test(value);
}

function unstringifyBigInts(value: unknown): unknown {
  if (typeof value === "string" && isIntegerLikeString(value)) {
    return BigInt(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => unstringifyBigInts(item));
  }
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = unstringifyBigInts(item);
    }
    return result;
  }
  return value;
}

function isGroth16Proof(value: unknown): value is Groth16Proof {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    Array.isArray(candidate.pi_a) &&
    Array.isArray(candidate.pi_b) &&
    Array.isArray(candidate.pi_c) &&
    typeof candidate.protocol === "string" &&
    typeof candidate.curve === "string"
  );
}

export function encodeBigIntToLeScalar(value: bigint, label: string): Buffer {
  if (value < 0n) {
    throw new Error(`${label} must be non-negative`);
  }

  const out = Buffer.alloc(SCALAR_BYTES);
  let remaining = value;
  for (let i = 0; i < SCALAR_BYTES; i++) {
    out[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  if (remaining !== 0n) {
    throw new Error(`${label} exceeds 32-byte scalar range`);
  }

  return out;
}

export function hash160ToFieldDecimal(value: string): string {
  const normalized = value.trim().replace(/^0x/i, "").toLowerCase();
  if (!HASH160_HEX_RE.test(value.trim())) {
    throw new Error("hash160 must be a 20-byte hex value");
  }
  return BigInt(`0x${normalized}`).toString();
}

async function getBlsCurve(): Promise<BlsCurve> {
  if (!cachedBlsCurvePromise) {
    cachedBlsCurvePromise = getCurveFromName("bls12381") as Promise<BlsCurve>;
  }
  return cachedBlsCurvePromise;
}

function convertFfCompressedToNeo(bytes: Uint8Array): Uint8Array {
  const output = Uint8Array.from(bytes);
  const ffSign = (output[0] & COMPRESSED_FLAG) !== 0;
  const ffInfinity = (output[0] & INFINITY_FLAG) !== 0;

  output[0] &= 0x1f;
  output[0] |= COMPRESSED_FLAG;
  if (ffInfinity) output[0] |= INFINITY_FLAG;
  if (ffSign) output[0] |= SIGN_FLAG;

  return output;
}

export async function encodeGroth16ProofPayload(proof: unknown): Promise<string> {
  if (!isGroth16Proof(proof)) {
    throw new Error("Invalid proof payload.");
  }

  const candidate = proof as unknown as Record<string, unknown>;
  const curveName = String(candidate.curve || "").toLowerCase();
  if (curveName !== "bls12381" && curveName !== "bls12-381") {
    throw new Error("Proof must target bls12381.");
  }

  try {
    const curve = await getBlsCurve();
    const normalizedProof = unstringifyBigInts(proof as unknown as Record<string, unknown>) as Record<string, unknown>;
    const proofA = curve.G1.fromObject(normalizedProof.pi_a);
    const proofB = curve.G2.fromObject(normalizedProof.pi_b);
    const proofC = curve.G1.fromObject(normalizedProof.pi_c);
    if (!curve.G1.isValid(proofA) || !curve.G2.isValid(proofB) || !curve.G1.isValid(proofC)) {
      throw new Error("proof points are not valid on bls12381");
    }

    const encodedA = new Uint8Array(48);
    const encodedB = new Uint8Array(96);
    const encodedC = new Uint8Array(48);
    curve.G1.toRprCompressed(encodedA, 0, proofA);
    curve.G2.toRprCompressed(encodedB, 0, proofB);
    curve.G1.toRprCompressed(encodedC, 0, proofC);

    const neoA = convertFfCompressedToNeo(encodedA);
    const neoB = convertFfCompressedToNeo(encodedB);
    const neoC = convertFfCompressedToNeo(encodedC);

    const payload = Buffer.concat([Buffer.from(neoA), Buffer.from(neoB), Buffer.from(neoC)]);
    if (payload.length !== GROTH16_PROOF_PACKED_BYTES) {
      throw new Error("packed proof length mismatch");
    }
    return payload.toString("base64");
  } catch (error: unknown) {
    throw new Error(
      error instanceof Error ? `Invalid proof payload: ${error.message}` : "Invalid proof payload.",
    );
  }
}

export function encodePublicInputsPayload(publicInputs: PublicSignals): string {
  if (!Array.isArray(publicInputs) || publicInputs.length !== PUBLIC_INPUT_COUNT) {
    throw new Error(`publicInputs must contain exactly ${PUBLIC_INPUT_COUNT} values.`);
  }

  const encoded: Buffer[] = [];
  for (let i = 0; i < publicInputs.length; i++) {
    encoded.push(encodeBigIntToLeScalar(BigInt(publicInputs[i]), `publicInputs[${i}]`));
  }

  const payload = Buffer.concat(encoded);
  if (payload.length !== GROTH16_PUBLIC_INPUTS_PACKED_BYTES) {
    throw new Error("publicInputs payload length mismatch.");
  }
  return payload.toString("base64");
}
