"use strict";

const constants = require("../../web/app/lib/poseidon-constants-opt.json");

const BLS_FIELD = 52435875175126190479447740508185965837690552500527637822603658699938581184513n;
const N_ROUNDS_F = 8;
const N_ROUNDS_P = [56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65, 70, 60, 64, 68];

function mod(value) {
  const result = value % BLS_FIELD;
  return result >= 0n ? result : result + BLS_FIELD;
}

function pow5(value) {
  const sq = mod(value * value);
  return mod(value * sq * sq);
}

function parseBigInt(value) {
  if (/^0x[0-9a-fA-F]+$/.test(value)) return BigInt(value);
  if (/^[0-9]+$/.test(value)) return BigInt(value);
  throw new Error(`Unsupported constant format: ${value}`);
}

function parseConstants(raw) {
  return {
    C: raw.C.map(parseBigInt),
    S: raw.S.map(parseBigInt),
    M: raw.M.map((row) => row.map(parseBigInt)),
    P: raw.P.map((row) => row.map(parseBigInt))
  };
}

const parsedByInputCount = {
  1: parseConstants(constants["1"]),
  2: parseConstants(constants["2"]),
  4: parseConstants(constants["4"])
};

function mix(state, matrix) {
  const out = new Array(state.length);
  for (let i = 0; i < state.length; i++) {
    let acc = 0n;
    for (let j = 0; j < state.length; j++) {
      acc = mod(acc + matrix[j][i] * state[j]);
    }
    out[i] = acc;
  }
  return out;
}

function poseidonBls(inputs) {
  if (!Array.isArray(inputs) || inputs.length <= 0) {
    throw new Error("Poseidon requires at least one input");
  }

  const opt = parsedByInputCount[inputs.length];
  if (!opt) {
    throw new Error(`Unsupported Poseidon arity: ${inputs.length}`);
  }

  const { C, S, M, P } = opt;
  const t = inputs.length + 1;
  const nRoundsP = N_ROUNDS_P[t - 2];
  let state = [0n, ...inputs.map((value) => mod(BigInt(value)))];

  state = state.map((value, i) => mod(value + C[i]));

  for (let r = 0; r < N_ROUNDS_F / 2 - 1; r++) {
    state = state.map(pow5);
    state = state.map((value, i) => mod(value + C[(r + 1) * t + i]));
    state = mix(state, M);
  }

  state = state.map(pow5);
  state = state.map((value, i) => mod(value + C[(N_ROUNDS_F / 2) * t + i]));
  state = mix(state, P);

  for (let r = 0; r < nRoundsP; r++) {
    state[0] = mod(pow5(state[0]) + C[(N_ROUNDS_F / 2 + 1) * t + r]);

    const s0 = state.reduce(
      (acc, value, j) => mod(acc + S[(t * 2 - 1) * r + j] * value),
      0n
    );

    for (let k = 1; k < t; k++) {
      state[k] = mod(state[k] + state[0] * S[(t * 2 - 1) * r + t + k - 1]);
    }
    state[0] = s0;
  }

  for (let r = 0; r < N_ROUNDS_F / 2 - 1; r++) {
    state = state.map(pow5);
    state = state.map((value, i) => mod(value + C[(N_ROUNDS_F / 2 + 1) * t + nRoundsP + r * t + i]));
    state = mix(state, M);
  }

  state = state.map(pow5);
  state = mix(state, M);
  return state[0];
}

function poseidon1Bls(values) {
  return poseidonBls(values);
}

function poseidon2Bls(values) {
  return poseidonBls(values);
}

function poseidon4Bls(values) {
  return poseidonBls(values);
}

module.exports = {
  poseidon1Bls,
  poseidon2Bls,
  poseidon4Bls
};
