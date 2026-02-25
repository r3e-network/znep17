import { afterEach, describe, expect, it, vi } from "vitest";
import { wallet } from "@cityofzion/neon-js";

const ORIGINAL_ENV = { ...process.env };
const PROOF_HEX = "11".repeat(32);
const VALID_TEST_WIF = "L4oAqBs8NPcbG7XDZs2dLTBX8rjbRf85LNjqjWH266DbYXYsBnAF";

function setBaseEnv() {
  const env = process.env as Record<string, string | undefined>;
  env["NODE_ENV"] = "test";
  env["VERCEL_ENV"] = "";
  env["RELAYER_WIF"] = VALID_TEST_WIF;
  env["VAULT_HASH"] = `0x${"22".repeat(20)}`;
  env["RELAYER_REQUIRE_DURABLE_GUARDS"] = "false";
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

function buildValidPostBody(overrides?: Partial<Record<string, unknown>>): Record<string, unknown> {
  const relayer = new wallet.Account(VALID_TEST_WIF);
  const base: Record<string, unknown> = {
    tokenHash: `0x${"33".repeat(20)}`,
    proof: {
      protocol: "groth16",
      curve: "bls12381",
      pi_a: ["1", "2", "1"],
      pi_b: [
        ["1", "2"],
        ["3", "4"],
        ["1", "0"],
      ],
      pi_c: ["5", "6", "1"],
    },
    publicInputs: ["0", "0", "0", "0", "0", "0", "0", "0"],
    merkleRoot: `0x${"11".repeat(32)}`,
    nullifierHash: `0x${"12".repeat(32)}`,
    commitment: `0x${"13".repeat(32)}`,
    recipient: `0x${"44".repeat(20)}`,
    relayer: relayer.scriptHash,
    amount: "10",
    fee: "100000000",
  };
  return { ...base, ...(overrides || {}) };
}

async function loadRouteModule() {
  vi.resetModules();
  return import("./route");
}

afterEach(() => {
  restoreEnvSnapshot();
  vi.resetModules();
});

describe("relay GET proof policy", () => {
  it("rejects proof requests from disallowed origins", async () => {
    setBaseEnv();
    const env = process.env as Record<string, string | undefined>;
    env["RELAYER_REQUIRE_ORIGIN_ALLOWLIST"] = "true";
    env["RELAYER_ALLOWED_ORIGINS"] = "https://app.example.com";
    env["RELAYER_REQUIRE_AUTH"] = "false";

    const { GET } = await loadRouteModule();
    const req = new Request(`https://relay.example.com/api/relay?proof=${PROOF_HEX}`, {
      method: "GET",
    });

    const res = await GET(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(403);
    expect(payload.error).toBe("Origin not allowed.");
  });

  it("rejects proof requests without API key when auth is required", async () => {
    setBaseEnv();
    const env = process.env as Record<string, string | undefined>;
    env["RELAYER_REQUIRE_ORIGIN_ALLOWLIST"] = "true";
    env["RELAYER_ALLOWED_ORIGINS"] = "https://app.example.com";
    env["RELAYER_REQUIRE_AUTH"] = "true";
    env["RELAYER_API_KEY"] = "test-secret";

    const { GET } = await loadRouteModule();
    const req = new Request(`https://relay.example.com/api/relay?proof=${PROOF_HEX}`, {
      method: "GET",
      headers: {
        origin: "https://app.example.com",
      },
    });

    const res = await GET(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(401);
    expect(payload.error).toBe("Missing or invalid relayer API key.");
  });

  it("rejects malformed proof commitment before tree processing", async () => {
    setBaseEnv();
    const env = process.env as Record<string, string | undefined>;
    env["RELAYER_REQUIRE_ORIGIN_ALLOWLIST"] = "true";
    env["RELAYER_ALLOWED_ORIGINS"] = "https://app.example.com";
    env["RELAYER_REQUIRE_AUTH"] = "true";
    env["RELAYER_API_KEY"] = "test-secret";

    const { GET } = await loadRouteModule();
    const req = new Request("https://relay.example.com/api/relay?proof=badhex", {
      method: "GET",
      headers: {
        origin: "https://app.example.com",
        "x-relayer-api-key": "test-secret",
      },
    });

    const res = await GET(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(payload.error).toContain("proof commitment");
  });

  it("fails configuration when strong on-chain verifier guard is disabled in production", async () => {
    setBaseEnv();
    const env = process.env as Record<string, string | undefined>;
    env["NODE_ENV"] = "production";
    env["VERCEL_ENV"] = "production";
    env["RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER"] = "false";
    env["RELAYER_REQUIRE_ORIGIN_ALLOWLIST"] = "true";
    env["RELAYER_ALLOWED_ORIGINS"] = "https://app.example.com";

    const { GET } = await loadRouteModule();
    const req = new Request("https://relay.example.com/api/relay", {
      method: "GET",
      headers: { origin: "https://app.example.com" },
    });

    const res = await GET(req);
    const payload = (await res.json()) as { configured?: boolean; issues?: string[] };

    expect(res.status).toBe(503);
    expect(payload.configured).toBe(false);
    expect(Array.isArray(payload.issues)).toBe(true);
    expect(payload.issues?.some((issue) => issue.includes("RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER"))).toBe(true);
  });

  it("fails configuration when expected verifier hash is missing in production strong mode", async () => {
    setBaseEnv();
    const env = process.env as Record<string, string | undefined>;
    env["NODE_ENV"] = "production";
    env["VERCEL_ENV"] = "production";
    env["RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER"] = "true";
    env["RELAYER_REQUIRE_ORIGIN_ALLOWLIST"] = "true";
    env["RELAYER_ALLOWED_ORIGINS"] = "https://app.example.com";
    env["ALLOWED_TOKEN_HASHES"] = `0x${"33".repeat(20)}`;
    env["RELAYER_REQUIRE_DURABLE_GUARDS"] = "false";

    const { GET } = await loadRouteModule();
    const req = new Request("https://relay.example.com/api/relay", {
      method: "GET",
      headers: { origin: "https://app.example.com" },
    });

    const res = await GET(req);
    const payload = (await res.json()) as { configured?: boolean; issues?: string[] };

    expect(res.status).toBe(503);
    expect(payload.configured).toBe(false);
    expect(Array.isArray(payload.issues)).toBe(true);
    expect(payload.issues?.some((issue) => issue.includes("RELAYER_EXPECTED_VERIFIER_HASH"))).toBe(true);
  });

  it("fails configuration when RPC_URL is insecure in production", async () => {
    setBaseEnv();
    const env = process.env as Record<string, string | undefined>;
    env["NODE_ENV"] = "production";
    env["VERCEL_ENV"] = "production";
    env["RPC_URL"] = "http://n3seed1.ngd.network:20332";
    env["RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER"] = "true";
    env["RELAYER_EXPECTED_VERIFIER_HASH"] = `0x${"55".repeat(20)}`;
    env["RELAYER_REQUIRE_ORIGIN_ALLOWLIST"] = "true";
    env["RELAYER_ALLOWED_ORIGINS"] = "https://app.example.com";
    env["ALLOWED_TOKEN_HASHES"] = `0x${"33".repeat(20)}`;
    env["RELAYER_REQUIRE_DURABLE_GUARDS"] = "true";
    env["KV_REST_API_URL"] = "https://example.upstash.io";
    env["KV_REST_API_TOKEN"] = "token";
    env["RELAYER_REQUIRE_AUTH"] = "false";

    const { GET } = await loadRouteModule();
    const req = new Request("https://relay.example.com/api/relay", {
      method: "GET",
      headers: { origin: "https://app.example.com" },
    });

    const res = await GET(req);
    const payload = (await res.json()) as { configured?: boolean; issues?: string[] };

    expect(res.status).toBe(503);
    expect(payload.configured).toBe(false);
    expect(Array.isArray(payload.issues)).toBe(true);
    expect(payload.issues?.some((issue) => issue.includes("RPC_URL must use https://"))).toBe(true);
  });

  it("sanitizes runtime initialization errors in production", async () => {
    setBaseEnv();
    const env = process.env as Record<string, string | undefined>;
    env["NODE_ENV"] = "production";
    env["VERCEL_ENV"] = "production";
    env["RPC_URL"] = "https://127.0.0.1:1";
    env["RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER"] = "true";
    env["RELAYER_EXPECTED_VERIFIER_HASH"] = `0x${"55".repeat(20)}`;
    env["RELAYER_REQUIRE_ORIGIN_ALLOWLIST"] = "true";
    env["RELAYER_ALLOWED_ORIGINS"] = "https://app.example.com";
    env["ALLOWED_TOKEN_HASHES"] = `0x${"33".repeat(20)}`;
    env["RELAYER_REQUIRE_DURABLE_GUARDS"] = "true";
    env["KV_REST_API_URL"] = "https://example.upstash.io";
    env["KV_REST_API_TOKEN"] = "token";
    env["RELAYER_REQUIRE_AUTH"] = "false";

    const { GET } = await loadRouteModule();
    const req = new Request("https://relay.example.com/api/relay", {
      method: "GET",
      headers: { origin: "https://app.example.com" },
    });

    const res = await GET(req);
    const payload = (await res.json()) as { configured?: boolean; error?: string };

    expect(res.status).toBe(503);
    expect(payload.configured).toBe(false);
    expect(payload.error).toBe("Failed to initialize relayer config.");
  });

  it("returns 400 for invalid tokenHash on POST", async () => {
    setBaseEnv();
    const { POST } = await loadRouteModule();
    const req = new Request("https://relay.example.com/api/relay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(
        buildValidPostBody({
          tokenHash: "not-a-hash",
        }),
      ),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(payload.error).toContain("tokenHash");
  });

  it("returns 400 for amount overflow on POST", async () => {
    setBaseEnv();
    const { POST } = await loadRouteModule();
    const req = new Request("https://relay.example.com/api/relay", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(
        buildValidPostBody({
          amount: "1".padEnd(90, "0"),
        }),
      ),
    });

    const res = await POST(req);
    const payload = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(payload.error).toContain("amount");
    expect(payload.error).toContain("32-byte scalar range");
  });
});
