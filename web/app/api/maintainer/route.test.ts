import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

type DepositRow = { leaf_index: number; leaf_hash: string };

const rpcInvokeFunctionMock = vi.fn();
const rpcGetVersionMock = vi.fn();
const contractInvokeMock = vi.fn();
const fullProveMock = vi.fn();
const depositsUpsertMock = vi.fn();
const merkleInsertMock = vi.fn();
const supabaseFromMock = vi.fn();

const supabaseState: {
  deposits: DepositRow[];
  merkleRoots: Array<Record<string, unknown>>;
  upsertError: { message: string } | null;
  insertError: { message: string } | null;
} = {
  deposits: [],
  merkleRoots: [],
  upsertError: null,
  insertError: null,
};

function intResult(value: number | string) {
  return { state: "HALT", stack: [{ type: "Integer", value: String(value) }] };
}

function byteResult(hex: string) {
  return { state: "HALT", stack: [{ type: "ByteString", value: Buffer.from(hex, "hex").toString("base64") }] };
}

function emptyByteResult() {
  return { state: "HALT", stack: [{ type: "ByteString", value: "" }] };
}

vi.mock("@cityofzion/neon-js", () => {
  class MockAccount {
    scriptHash: string;

    constructor(wif: string) {
      if (!wif || wif.trim().toLowerCase() === "invalid") {
        throw new Error("invalid wif");
      }
      this.scriptHash = `0x${"ab".repeat(20)}`;
    }
  }

  class MockRPCClient {
    invokeFunction = rpcInvokeFunctionMock;
    getVersion = rpcGetVersionMock;
  }

  class MockSmartContract {
    invoke = contractInvokeMock;
  }

  class MockSigner {
    constructor() {}
  }

  return {
    wallet: {
      Account: MockAccount,
    },
    rpc: {
      RPCClient: MockRPCClient,
    },
    experimental: {
      SmartContract: MockSmartContract,
    },
    tx: {
      Signer: MockSigner,
      WitnessScope: {
        CalledByEntry: 1,
      },
    },
    sc: {
      ContractParam: {
        integer: (value: number) => ({ type: "Integer", value }),
        byteArray: (value: string) => ({ type: "ByteArray", value }),
      },
    },
  };
});

vi.mock("@upstash/redis", () => {
  class MockRedis {
    async set() {
      return "OK";
    }
    async del() {
      return 1;
    }
  }
  return { Redis: MockRedis };
});

vi.mock("../../lib/blsPoseidon", () => ({
  poseidon2Bls: ([left, right]: [bigint, bigint]) => (left * 131n + right * 17n + 7n) % ((1n << 255n) - 19n),
}));

vi.mock("../../lib/supabase", () => ({
  getSupabaseAdminClient: vi.fn(() => ({
    from: supabaseFromMock,
  })),
}));

vi.mock("snarkjs", () => ({
  groth16: {
    fullProve: fullProveMock,
  },
}));

vi.mock("../relay/zk-encoding", () => ({
  encodeGroth16ProofPayload: vi.fn(async () => Buffer.alloc(192, 0x42).toString("base64")),
  encodeBigIntToLeScalar: (value: bigint) => {
    const out = Buffer.alloc(32);
    let remaining = value;
    for (let i = 0; i < 32; i++) {
      out[i] = Number(remaining & 0xffn);
      remaining >>= 8n;
    }
    return out;
  },
}));

function configureSupabaseMock(): void {
  supabaseFromMock.mockImplementation((table: string) => {
    if (table === "deposits") {
      return {
        select: () => ({
          lt: (_column: string, limit: number) => ({
            order: async () => ({
              data: supabaseState.deposits
                .filter((row) => row.leaf_index < limit)
                .sort((a, b) => a.leaf_index - b.leaf_index),
              error: null,
            }),
          }),
        }),
        upsert: depositsUpsertMock,
      };
    }

    if (table === "merkle_roots") {
      return {
        insert: merkleInsertMock,
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  depositsUpsertMock.mockImplementation(async (rows: DepositRow[]) => {
    if (supabaseState.upsertError) {
      return { error: supabaseState.upsertError };
    }
    for (const row of rows) {
      const existingIndex = supabaseState.deposits.findIndex((entry) => entry.leaf_index === row.leaf_index);
      if (existingIndex >= 0) {
        supabaseState.deposits[existingIndex] = { ...row };
      } else {
        supabaseState.deposits.push({ ...row });
      }
    }
    return { error: null };
  });

  merkleInsertMock.mockImplementation(async (payload: Record<string, unknown>) => {
    if (supabaseState.insertError) {
      return { error: supabaseState.insertError };
    }
    supabaseState.merkleRoots.push({ ...payload });
    return { error: null };
  });
}

function setBaseEnv() {
  const env = process.env as Record<string, string | undefined>;
  env["NODE_ENV"] = "test";
  env["VERCEL_ENV"] = "";
  env["MAINTAINER_VAULT_HASH"] = `0x${"11".repeat(20)}`;
  env["MAINTAINER_WIF"] = "valid-test-maintainer-wif";
  env["MAINTAINER_REQUIRE_AUTH"] = "false";
  env["MAINTAINER_REQUIRE_DURABLE_LOCK"] = "false";
  env["MAINTAINER_REQUIRE_ORIGIN_ALLOWLIST"] = "false";
  delete env["MAINTAINER_API_KEY"];
  delete env["MAINTAINER_ALLOWED_ORIGINS"];
  delete env["KV_REST_API_URL"];
  delete env["KV_REST_API_TOKEN"];
  delete env["RPC_URL"];
  delete env["MAINTAINER_RPC_URL"];
}

function restoreEnvSnapshot() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (typeof value === "undefined") {
      delete process.env[key];
    } else {
      (process.env as Record<string, string | undefined>)[key] = value;
    }
  }
}

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

beforeEach(() => {
  supabaseState.deposits = [];
  supabaseState.merkleRoots = [];
  supabaseState.upsertError = null;
  supabaseState.insertError = null;
  depositsUpsertMock.mockReset();
  merkleInsertMock.mockReset();
  supabaseFromMock.mockReset();
  configureSupabaseMock();
  rpcInvokeFunctionMock.mockReset();
  rpcGetVersionMock.mockReset();
  contractInvokeMock.mockReset();
  fullProveMock.mockReset();
  fullProveMock.mockImplementation(async (witness: Record<string, string>) => ({
    proof: {},
    publicSignals: [
      witness.oldRoot,
      witness.newRoot,
      witness.oldLeaf,
      witness.newLeaf,
      witness.leafIndex,
    ],
  }));
});

afterEach(() => {
  restoreEnvSnapshot();
  vi.resetModules();
});

describe("maintainer route", () => {
  it("fails closed in production when MAINTAINER_API_KEY is missing", async () => {
    setBaseEnv();
    const env = process.env as Record<string, string | undefined>;
    env["NODE_ENV"] = "production";
    env["VERCEL_ENV"] = "production";
    env["MAINTAINER_REQUIRE_AUTH"] = "true";
    env["MAINTAINER_REQUIRE_DURABLE_LOCK"] = "true";
    env["KV_REST_API_URL"] = "https://example.upstash.io";
    env["KV_REST_API_TOKEN"] = "token";

    const { POST } = await loadRoute();
    const response = await POST(new Request("https://app.example.com/api/maintainer", { method: "POST" }));
    const payload = (await response.json()) as { issues?: string[] };

    expect(response.status).toBe(503);
    expect(Array.isArray(payload.issues)).toBe(true);
    expect(payload.issues?.some((issue) => issue.includes("MAINTAINER_API_KEY"))).toBe(true);
  });

  it("fails closed in production when allowlist contains insecure origins", async () => {
    setBaseEnv();
    const env = process.env as Record<string, string | undefined>;
    env["NODE_ENV"] = "production";
    env["VERCEL_ENV"] = "production";
    env["MAINTAINER_REQUIRE_AUTH"] = "true";
    env["MAINTAINER_API_KEY"] = "expected-secret";
    env["MAINTAINER_REQUIRE_DURABLE_LOCK"] = "true";
    env["KV_REST_API_URL"] = "https://example.upstash.io";
    env["KV_REST_API_TOKEN"] = "token";
    env["MAINTAINER_REQUIRE_ORIGIN_ALLOWLIST"] = "true";
    env["MAINTAINER_ALLOWED_ORIGINS"] = "http://app.example.com";

    const { POST } = await loadRoute();
    const response = await POST(new Request("https://app.example.com/api/maintainer", { method: "POST" }));
    const payload = (await response.json()) as { issues?: string[] };

    expect(response.status).toBe(503);
    expect(Array.isArray(payload.issues)).toBe(true);
    expect(payload.issues?.some((issue) => issue.includes("https origins"))).toBe(true);
  });

  it("rejects request with invalid maintainer API key", async () => {
    setBaseEnv();
    const env = process.env as Record<string, string | undefined>;
    env["MAINTAINER_REQUIRE_AUTH"] = "true";
    env["MAINTAINER_API_KEY"] = "expected-secret";

    const { POST } = await loadRoute();
    const response = await POST(
      new Request("https://app.example.com/api/maintainer", {
        method: "POST",
        headers: {
          "x-maintainer-api-key": "wrong-secret",
        },
      }),
    );
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(401);
    expect(payload.error).toBe("Missing or invalid maintainer API key.");
  });

  it("rejects oversized cache gaps beyond MAINTAINER_MAX_SYNC_LEAVES", async () => {
    setBaseEnv();
    const env = process.env as Record<string, string | undefined>;
    env["MAINTAINER_MAX_SYNC_LEAVES"] = "1";

    rpcInvokeFunctionMock.mockImplementation(async (_hash: string, operation: string) => {
      if (operation === "getLeafIndex") return intResult(3);
      if (operation === "getLastRootLeafCount") return intResult(2);
      if (operation === "getCurrentRoot") return emptyByteResult();
      throw new Error(`Unexpected operation: ${operation}`);
    });

    const { POST } = await loadRoute();
    const response = await POST(new Request("https://app.example.com/api/maintainer", { method: "POST" }));
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(503);
    expect(payload.error).toContain("exceeding MAINTAINER_MAX_SYNC_LEAVES");
    expect(contractInvokeMock).not.toHaveBeenCalled();
  });

  it("does not block on missing leaves beyond the next update step", async () => {
    setBaseEnv();
    const env = process.env as Record<string, string | undefined>;
    env["MAINTAINER_MAX_SYNC_LEAVES"] = "1";
    rpcGetVersionMock.mockResolvedValue({ protocol: { network: 894710606 } });
    contractInvokeMock.mockResolvedValue("0xtesttx");

    rpcInvokeFunctionMock.mockImplementation(async (_hash: string, operation: string) => {
      if (operation === "getLeafIndex") return intResult(3);
      if (operation === "getLastRootLeafCount") return intResult(0);
      if (operation === "getCurrentRoot") return emptyByteResult();
      if (operation === "getLeaf") return byteResult("03".repeat(32));
      throw new Error(`Unexpected operation: ${operation}`);
    });

    const { POST } = await loadRoute();
    const response = await POST(new Request("https://app.example.com/api/maintainer", { method: "POST" }));

    expect(response.status).toBe(200);
    const getLeafCalls = rpcInvokeFunctionMock.mock.calls.filter(([, operation]) => operation === "getLeaf");
    expect(getLeafCalls).toHaveLength(1);
    expect(contractInvokeMock).toHaveBeenCalledTimes(1);
  });

  it("allows leaf count growth during proof computation", async () => {
    setBaseEnv();
    supabaseState.deposits = [{ leaf_index: 0, leaf_hash: "01".repeat(32) }];

    let leafIndexCall = 0;
    rpcInvokeFunctionMock.mockImplementation(async (_hash: string, operation: string) => {
      if (operation === "getLeafIndex") {
        leafIndexCall += 1;
        return intResult(leafIndexCall === 1 ? 1 : 2);
      }
      if (operation === "getLastRootLeafCount") return intResult(0);
      if (operation === "getCurrentRoot") return emptyByteResult();
      if (operation === "getLeaf") return byteResult("01".repeat(32));
      throw new Error(`Unexpected operation: ${operation}`);
    });
    rpcGetVersionMock.mockResolvedValue({ protocol: { network: 894710606 } });
    contractInvokeMock.mockResolvedValue("0xtesttx");

    const { POST } = await loadRoute();
    const response = await POST(new Request("https://app.example.com/api/maintainer", { method: "POST" }));
    expect(response.status).toBe(200);
    expect(contractInvokeMock).toHaveBeenCalledTimes(1);
  });

  it("publishes a root and persists metadata on success", async () => {
    setBaseEnv();
    rpcGetVersionMock.mockResolvedValue({ protocol: { network: 894710606 } });
    contractInvokeMock.mockResolvedValue("0xtesttx");

    rpcInvokeFunctionMock.mockImplementation(async (_hash: string, operation: string) => {
      if (operation === "getLeafIndex") {
        return intResult(1);
      }
      if (operation === "getLastRootLeafCount") return intResult(0);
      if (operation === "getCurrentRoot") return emptyByteResult();
      if (operation === "getLeaf") return byteResult("02".repeat(32));
      throw new Error(`Unexpected operation: ${operation}`);
    });

    const { POST } = await loadRoute();
    const response = await POST(new Request("https://app.example.com/api/maintainer", { method: "POST" }));
    const payload = (await response.json()) as {
      success?: boolean;
      txid?: string;
      newRoot?: string;
      leavesProcessed?: number;
    };

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.txid).toBe("0xtesttx");
    expect(payload.newRoot).toMatch(/^[0-9a-f]{64}$/);
    expect(payload.leavesProcessed).toBe(1);
    expect(contractInvokeMock).toHaveBeenCalledTimes(1);
    const [operation, params] = contractInvokeMock.mock.calls[0] as [string, Array<{ type: string; value: string }>];
    expect(operation).toBe("updateMerkleRoot");
    expect(Array.isArray(params)).toBe(true);
    expect(params).toHaveLength(3);
    expect(params[0]?.type).toBe("ByteArray"); // tree-update proof payload (base64)
    expect(params[1]?.type).toBe("ByteArray"); // tree-update public inputs payload (base64)
    expect(params[2]?.type).toBe("ByteArray"); // new root payload (base64)
    expect(depositsUpsertMock).toHaveBeenCalledTimes(1);
    expect(merkleInsertMock).toHaveBeenCalledTimes(1);
    expect(supabaseState.merkleRoots).toHaveLength(1);
  });

  it("catches up one leaf per run until remainingLeaves reaches zero", async () => {
    setBaseEnv();
    rpcGetVersionMock.mockResolvedValue({ protocol: { network: 894710606 } });

    const chainState = {
      leafCount: 3,
      lastRootLeafCount: 0,
      currentRootHex: "",
      leaves: ["01".repeat(32), "02".repeat(32), "03".repeat(32)],
    };

    rpcInvokeFunctionMock.mockImplementation(async (_hash: string, operation: string, args: unknown[] = []) => {
      if (operation === "getLeafIndex") return intResult(chainState.leafCount);
      if (operation === "getLastRootLeafCount") return intResult(chainState.lastRootLeafCount);
      if (operation === "getCurrentRoot") {
        return chainState.currentRootHex ? byteResult(chainState.currentRootHex) : emptyByteResult();
      }
      if (operation === "getLeaf") {
        const request = args[0] as { value?: unknown } | undefined;
        const index = typeof request?.value === "number" ? request.value : Number(request?.value);
        return byteResult(chainState.leaves[index] || "00".repeat(32));
      }
      throw new Error(`Unexpected operation: ${operation}`);
    });

    contractInvokeMock.mockImplementation(async (_operation: string, params: Array<{ value: string }>) => {
      const newRootPayload = params[2]?.value || "";
      chainState.currentRootHex = Buffer.from(newRootPayload, "base64").toString("hex");
      chainState.lastRootLeafCount += 1;
      return `0xtesttx${chainState.lastRootLeafCount}`;
    });

    const { POST } = await loadRoute();
    async function runOnce() {
      const response = await POST(new Request("https://app.example.com/api/maintainer", { method: "POST" }));
      const payload = (await response.json()) as {
        leavesProcessed?: number;
        remainingLeaves?: number;
        message?: string;
        currentLeaves?: number;
      };
      return { response, payload };
    }

    const first = await runOnce();
    expect(first.response.status).toBe(200);
    expect(first.payload.leavesProcessed).toBe(1);
    expect(first.payload.remainingLeaves).toBe(2);

    const second = await runOnce();
    expect(second.response.status).toBe(200);
    expect(second.payload.leavesProcessed).toBe(2);
    expect(second.payload.remainingLeaves).toBe(1);

    const third = await runOnce();
    expect(third.response.status).toBe(200);
    expect(third.payload.leavesProcessed).toBe(3);
    expect(third.payload.remainingLeaves).toBe(0);

    const fourth = await runOnce();
    expect(fourth.response.status).toBe(200);
    expect(fourth.payload.message).toBe("Tree is already up to date.");
    expect(fourth.payload.currentLeaves).toBe(3);

    expect(contractInvokeMock).toHaveBeenCalledTimes(3);
    const getLeafCalls = rpcInvokeFunctionMock.mock.calls.filter(([, operation]) => operation === "getLeaf");
    expect(getLeafCalls).toHaveLength(3);
    expect(depositsUpsertMock).toHaveBeenCalledTimes(3);
    expect(merkleInsertMock).toHaveBeenCalledTimes(3);
  });
});
