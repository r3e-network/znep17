import rawConstants from "./poseidon-constants-opt.json";

const BLS_FIELD = 52435875175126190479447740508185965837690552500527637822603658699938581184513n;
const N_ROUNDS_F = 8;
const N_ROUNDS_P = [56, 57, 56, 60, 60, 63, 64, 63, 60, 66, 60, 65, 70, 60, 64, 68];

type RawOptConstants = {
  C: string[];
  S: string[];
  M: string[][];
  P: string[][];
};

type OptConstants = {
  C: bigint[];
  S: bigint[];
  M: bigint[][];
  P: bigint[][];
};

const constantsByInputCount = new Map<number, OptConstants>();

function mod(value: bigint): bigint {
  const result = value % BLS_FIELD;
  return result >= 0n ? result : result + BLS_FIELD;
}

function pow5(value: bigint): bigint {
  const sq = mod(value * value);
  return mod(value * sq * sq);
}

function parseBigInt(value: string): bigint {
  if (/^0x[0-9a-fA-F]+$/.test(value)) return BigInt(value);
  if (/^[0-9]+$/.test(value)) return BigInt(value);
  throw new Error(`Unsupported constant format: ${value}`);
}

function parseConstants(raw: RawOptConstants): OptConstants {
  return {
    C: raw.C.map(parseBigInt),
    S: raw.S.map(parseBigInt),
    M: raw.M.map((row) => row.map(parseBigInt)),
    P: raw.P.map((row) => row.map(parseBigInt)),
  };
}

function getConstants(inputCount: number): OptConstants {
  const cached = constantsByInputCount.get(inputCount);
  if (cached) return cached;

  const source = (rawConstants as Record<string, RawOptConstants>)[String(inputCount)];
  if (!source) {
    throw new Error(`Unsupported Poseidon arity: ${inputCount}`);
  }

  const parsed = parseConstants(source);
  constantsByInputCount.set(inputCount, parsed);
  return parsed;
}

function mix(state: bigint[], matrix: bigint[][]): bigint[] {
  const out = new Array<bigint>(state.length);
  for (let i = 0; i < state.length; i++) {
    let acc = 0n;
    for (let j = 0; j < state.length; j++) {
      acc = mod(acc + matrix[j][i] * state[j]);
    }
    out[i] = acc;
  }
  return out;
}

function poseidonBls(inputs: bigint[]): bigint {
  if (inputs.length <= 0) {
    throw new Error("Poseidon requires at least one input.");
  }
  if (inputs.length > N_ROUNDS_P.length) {
    throw new Error(`Unsupported Poseidon arity: ${inputs.length}`);
  }

  const { C, S, M, P } = getConstants(inputs.length);
  const t = inputs.length + 1;
  const nRoundsP = N_ROUNDS_P[t - 2];

  let state = [0n, ...inputs.map((value) => mod(value))];
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
      0n,
    );

    for (let k = 1; k < t; k++) {
      state[k] = mod(state[k] + state[0] * S[(t * 2 - 1) * r + t + k - 1]);
    }
    state[0] = s0;
  }

  for (let r = 0; r < N_ROUNDS_F / 2 - 1; r++) {
    state = state.map(pow5);
    state = state.map((value, i) =>
      mod(value + C[(N_ROUNDS_F / 2 + 1) * t + nRoundsP + r * t + i]),
    );
    state = mix(state, M);
  }

  state = state.map(pow5);
  state = mix(state, M);
  return state[0];
}

export function poseidon1Bls(values: [bigint]): bigint {
  return poseidonBls(values);
}

export function poseidon2Bls(values: [bigint, bigint]): bigint {
  return poseidonBls(values);
}

export function poseidon4Bls(values: [bigint, bigint, bigint, bigint]): bigint {
  return poseidonBls(values);
}
