import { describe, expect, it } from "vitest";
import { poseidon1Bls, poseidon2Bls, poseidon4Bls } from "../../lib/blsPoseidon";

describe("BLS poseidon compatibility vectors", () => {
  it("matches expected one-input hash vector", () => {
    const hash = poseidon1Bls([1n]).toString();
    expect(hash).toBe("907856803541436205028955228894831559056854519137108240336065231664534533428");
  });

  it("matches expected two-input hash vector", () => {
    const hash = poseidon2Bls([1n, 2n]).toString();
    expect(hash).toBe("45600944414554403871798976199491457883572483230756428072454398611940799568185");
  });

  it("matches expected four-input hash vector", () => {
    const hash = poseidon4Bls([1n, 2n, 3n, 4n]).toString();
    expect(hash).toBe("4105953746092039486720437895468607945815142249328081011330553523700384157569");
  });
});
