import { describe, expect, it } from "vitest";
import { u } from "@cityofzion/neon-js";
import {
  encodeBigIntToLeScalar,
  encodeGroth16ProofPayload,
  encodePublicInputsPayload,
  hash160ToFieldDecimal,
} from "./zk-encoding";

function encodeLe32(value: bigint): Buffer {
  const out = Buffer.alloc(32);
  let current = value;
  for (let i = 0; i < 32; i++) {
    out[i] = Number(current & 0xffn);
    current >>= 8n;
  }
  return out;
}

describe("relay encoding helpers", () => {
  it("packs public inputs as 8 x 32-byte little-endian payload", async () => {
    const signals = [
      "1",
      "256",
      "65535",
      "0",
      "42",
      "100000000",
      "340282366920938463463374607431768211455",
      "999999999999999999",
    ];

    const payloadB64 = encodePublicInputsPayload(signals);
    const payload = Buffer.from(payloadB64, "base64");

    expect(payload.length).toBe(256);
    for (let i = 0; i < signals.length; i++) {
      const expected = encodeLe32(BigInt(signals[i]));
      const got = payload.subarray(i * 32, (i + 1) * 32);
      expect(got.equals(expected)).toBe(true);
    }
  });

  it("rejects public-input values outside 32-byte scalar range", async () => {
    expect(() => encodeBigIntToLeScalar(1n << 256n, "test")).toThrow("32-byte scalar range");
  });

  it("rejects non-bls proof curve before packing", async () => {
    await expect(
      encodeGroth16ProofPayload({
        protocol: "groth16",
        curve: "bn128",
        pi_a: ["1", "2", "1"],
        pi_b: [
          ["1", "2"],
          ["3", "4"],
          ["1", "0"],
        ],
        pi_c: ["5", "6", "1"],
      }),
    ).rejects.toThrow("bls12381");
  });

  it("converts hash160 values to field scalars using Neo UInt160 byte order", () => {
    const scriptHash = "7f9acb9b3537c3b9ee4cb97a5656b595f072b665";
    const scalar = encodeBigIntToLeScalar(BigInt(hash160ToFieldDecimal(scriptHash)), "hash160");

    expect(scalar.subarray(0, 20).toString("hex")).toBe(u.reverseHex(scriptHash));
    expect(scalar.subarray(20).equals(Buffer.alloc(12))).toBe(true);
  });
});
