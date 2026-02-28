import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };
const VALID_TEST_WIF = "L4oAqBs8NPcbG7XDZs2dLTBX8rjbRf85LNjqjWH266DbYXYsBnAF";
const rpcInvokeFunctionMock = vi.fn();
const rpcGetVersionMock = vi.fn();

vi.mock("@cityofzion/neon-js", () => {
  class MockAccount {
    scriptHash: string;
    address: string;

    constructor(wif: string) {
      if (!wif || wif.trim().length === 0) {
        throw new Error("invalid wif");
      }
      this.scriptHash = `0x${"ab".repeat(20)}`;
      this.address = "NTEST_ACCOUNT";
    }
  }

  class MockRPCClient {
    invokeFunction = rpcInvokeFunctionMock;
    getVersion = rpcGetVersionMock;
  }

  class MockSmartContract {
    async invoke() {
      return "0xtest";
    }
  }

  return {
    wallet: {
      Account: MockAccount,
      isAddress: () => false,
      getScriptHashFromAddress: () => `0x${"cd".repeat(20)}`,
    },
    rpc: {
      RPCClient: MockRPCClient,
    },
    sc: {
      ContractParam: {
        byteArray: (value: string) => ({ type: "ByteArray", value }),
        integer: (value: string) => ({ type: "Integer", value }),
        hash160: (value: string) => ({ type: "Hash160", value }),
      },
    },
    tx: {
      Signer: class {},
      WitnessScope: {
        CalledByEntry: 1,
      },
    },
    experimental: {
      SmartContract: MockSmartContract,
    },
    u: {
      reverseHex: (input: string) => input,
    },
  };
});

function setBaseEnv() {
  const env = process.env as Record<string, string | undefined>;
  env["NODE_ENV"] = "test";
  env["VERCEL_ENV"] = "";
  env["RELAYER_WIF"] = VALID_TEST_WIF;
  env["VAULT_HASH"] = `0x${"22".repeat(20)}`;
  env["RELAYER_REQUIRE_DURABLE_GUARDS"] = "false";
  env["RELAYER_REQUIRE_ORIGIN_ALLOWLIST"] = "false";
  env["RELAYER_REQUIRE_AUTH"] = "false";
  env["RELAYER_API_KEY"] = "test-secret";
  env["KV_REST_API_URL"] = "";
  env["KV_REST_API_TOKEN"] = "";
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

async function loadRouteModule() {
  vi.resetModules();
  return import("./route");
}

beforeEach(() => {
  rpcInvokeFunctionMock.mockReset();
  rpcGetVersionMock.mockReset();
});

afterEach(() => {
  restoreEnvSnapshot();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("relay maintainer auto-kick", () => {
  it("kicks maintainer when proof request is pending finalization", async () => {
    setBaseEnv();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    rpcInvokeFunctionMock.mockImplementation(async (_hash: string, operation: string) => {
      if (operation === "getCommitmentIndex") {
        return { state: "HALT", stack: [{ type: "Integer", value: "13" }] };
      }
      if (operation === "getLeafIndex") {
        return { state: "HALT", stack: [{ type: "Integer", value: "14" }] };
      }
      if (operation === "getLastRootLeafCount") {
        return { state: "HALT", stack: [{ type: "Integer", value: "12" }] };
      }
      throw new Error(`Unexpected operation ${operation}`);
    });

    const proofHex = "11".repeat(32);
    const { GET } = await loadRouteModule();
    const response = await GET(
      new Request(`https://www.znep17.app/api/relay?proof=${proofHex}&mode=soft`, {
        method: "GET",
        headers: {
          origin: "https://www.znep17.app",
        },
      }),
    );
    const payload = (await response.json()) as { pendingFinalization?: boolean };

    expect(response.status).toBe(200);
    expect(payload.pendingFinalization).toBe(true);
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
