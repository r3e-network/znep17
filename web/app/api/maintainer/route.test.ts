import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

type DepositRow = { leaf_index: number; leaf_hash: string };

const rpcInvokeFunctionMock = vi.fn();
const rpcGetVersionMock = vi.fn();
const contractInvokeMock = vi.fn();
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
  configureSupabaseMock();
  rpcInvokeFunctionMock.mockReset();
  rpcGetVersionMock.mockReset();
  contractInvokeMock.mockReset();
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
      if (operation === "getLastRootLeafCount") return intResult(0);
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

  it("returns conflict when chain leaf count changes during root computation", async () => {
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
      throw new Error(`Unexpected operation: ${operation}`);
    });

    const { POST } = await loadRoute();
    const response = await POST(new Request("https://app.example.com/api/maintainer", { method: "POST" }));
    const payload = (await response.json()) as { error?: string };

    expect(response.status).toBe(409);
    expect(payload.error).toContain("Chain state changed while computing root");
    expect(contractInvokeMock).not.toHaveBeenCalled();
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
    expect(depositsUpsertMock).toHaveBeenCalledTimes(1);
    expect(merkleInsertMock).toHaveBeenCalledTimes(1);
    expect(supabaseState.merkleRoots).toHaveLength(1);
  });
});
