import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { tx, wallet, sc, experimental, u, rpc } from "@cityofzion/neon-js";
import { Redis } from "@upstash/redis";
import type { Groth16Proof, PublicSignals } from "snarkjs";
import vKey from "../../../public/zk/verification_key.json";
import { getClientIpFromHeaders, isOriginAllowed, parseOriginAllowlist, readApiCredential } from "./policy";
import { encodeGroth16ProofPayload, encodePublicInputsPayload, hash160ToFieldDecimal } from "./zk-encoding";
import { poseidon2Bls } from "../../lib/blsPoseidon";
import {
  DEFAULT_ALLOWED_TOKEN_HASHES,
  DEFAULT_RELAYER_ALLOWED_ORIGINS,
  DEFAULT_RPC_URL,
  DEFAULT_VAULT_HASH,
  DEFAULT_VERIFIER_HASH,
} from "../../lib/deployment-defaults";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ALLOW_TEST_OVERRIDES = process.env.VITEST === "true";
const TEST_RPC_URL_FALLBACK = "https://testnet1.neo.coz.io:443";
const RPC_URL = (ALLOW_TEST_OVERRIDES ? process.env.RPC_URL || TEST_RPC_URL_FALLBACK : "") || DEFAULT_RPC_URL;
const RELAYER_WIF = process.env.RELAYER_WIF || "";
const VAULT_HASH = (ALLOW_TEST_OVERRIDES ? process.env.VAULT_HASH : "") || DEFAULT_VAULT_HASH;
const ALLOWED_TOKEN_HASHES =
  (ALLOW_TEST_OVERRIDES ? process.env.ALLOWED_TOKEN_HASHES : "") || DEFAULT_ALLOWED_TOKEN_HASHES;
const RELAYER_ALLOWED_ORIGINS =
  (ALLOW_TEST_OVERRIDES ? process.env.RELAYER_ALLOWED_ORIGINS : "") || DEFAULT_RELAYER_ALLOWED_ORIGINS;
const RELAYER_API_KEY = process.env.RELAYER_API_KEY || "";
const NODE_ENV = (process.env.NODE_ENV || "development").trim().toLowerCase();
const VERCEL_ENV = (process.env.VERCEL_ENV || "").trim().toLowerCase();
const IS_PRODUCTION = VERCEL_ENV === "production" || (NODE_ENV === "production" && VERCEL_ENV.length === 0);

const HASH160_HEX_RE = /^(?:0x)?[0-9a-fA-F]{40}$/;
const HEX32_RE = /^[0-9a-fA-F]{64}$/;
const INT_RE = /^(?:0|[1-9]\d*)$/;
const ZERO_HASH160 = "0".repeat(40);
const MAX_BODY_BYTES = 128 * 1024;
const MAX_PUBLIC_INPUT_COUNT = 8;
const MAX_PUBLIC_INPUT_DECIMAL_LENGTH = 78;
const MAX_PROOF_JSON_BYTES = 8192;
const MIN_FEE = 100000000n;
const MAX_UINT256 = (1n << 256n) - 1n;
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_REQUESTS = 30;
const PROOF_RATE_MAX_REQUESTS = 6;
const RATE_LIMIT_MAX_TRACKED_KEYS = 4096;
const NULLIFIER_LOCK_TTL_MS = 120_000;
const NETWORK_MAGIC_CACHE_MS = 300_000;
const TREE_DEPTH = 20;
const MERKLE_MAX_BOOTSTRAP_LEAVES = 50_000;
const MERKLE_MAX_LEAVES_HARD_LIMIT = 200_000;
const VERIFIER_PROBE_CACHE_MS = 300_000;
const DEFAULT_MAINTAINER_AUTOKICK_INTERVAL_MS = 20_000;
const DEFAULT_MAINTAINER_AUTOKICK_TIMEOUT_MS = 3_000;
const MAINTAINER_STATUS_KEY_PREFIX = "znep17:maintainer-status:";
const MAINTAINER_STATUS_MAX_AGE_MS = 60 * 60_000;

type ProofMode = "snark";
type GuardStoreMode = "memory" | "durable";

type RelayRequestBody = {
  tokenHash: string;
  proof?: unknown;
  publicInputs: unknown;
  merkleRoot: string;
  nullifierHash: string;
  commitment: string;
  newCommitment: string;
  recipient: string;
  relayer: string;
  amount: string;
  fee: string;
};

type SnarkjsLike = {
  groth16: {
    verify: (verificationKey: unknown, publicSignals: PublicSignals, proof: Groth16Proof) => Promise<boolean>;
  };
};

type RpcStackItem = {
  type?: string;
  value?: unknown;
};

type MaintainerStatusSnapshot = {
  state?: string;
  stage?: string;
  runId?: string;
  startedAt?: string;
  updatedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
  txid?: string;
  newRoot?: string;
  leavesProcessed?: number;
  remainingLeaves?: number;
  currentLeaves?: number;
};

const RELAYER_PROOF_MODE: ProofMode = "snark";
const RELAYER_REQUIRE_AUTH = parseBooleanEnv(ALLOW_TEST_OVERRIDES ? process.env.RELAYER_REQUIRE_AUTH : undefined, false);
const RELAYER_REQUIRE_ORIGIN_ALLOWLIST = parseBooleanEnv(
  ALLOW_TEST_OVERRIDES ? process.env.RELAYER_REQUIRE_ORIGIN_ALLOWLIST : undefined,
  true,
);
const RELAYER_REQUIRE_DURABLE_GUARDS = parseBooleanEnv(
  ALLOW_TEST_OVERRIDES ? process.env.RELAYER_REQUIRE_DURABLE_GUARDS : undefined,
  true,
);
const RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER = parseBooleanEnv(
  ALLOW_TEST_OVERRIDES ? process.env.RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER : undefined,
  true,
);
const RELAYER_ALLOW_INSECURE_RPC = parseBooleanEnv(
  ALLOW_TEST_OVERRIDES ? process.env.RELAYER_ALLOW_INSECURE_RPC : undefined,
  !ALLOW_TEST_OVERRIDES && !hasSecureRpcTransport(RPC_URL),
);
const RELAYER_TRUST_PROXY_HEADERS = parseBooleanEnv(
  ALLOW_TEST_OVERRIDES ? process.env.RELAYER_TRUST_PROXY_HEADERS : undefined,
  true,
);
const RELAYER_ENABLE_MAINTAINER_AUTOKICK = parseBooleanEnv(
  ALLOW_TEST_OVERRIDES ? process.env.RELAYER_ENABLE_MAINTAINER_AUTOKICK : undefined,
  true,
);
const RELAYER_MAINTAINER_AUTOKICK_INTERVAL_MS = parsePositiveIntEnv(
  ALLOW_TEST_OVERRIDES ? process.env.RELAYER_MAINTAINER_AUTOKICK_INTERVAL_MS : undefined,
  DEFAULT_MAINTAINER_AUTOKICK_INTERVAL_MS,
);
const RELAYER_MAINTAINER_AUTOKICK_TIMEOUT_MS = parsePositiveIntEnv(
  ALLOW_TEST_OVERRIDES ? process.env.RELAYER_MAINTAINER_AUTOKICK_TIMEOUT_MS : undefined,
  DEFAULT_MAINTAINER_AUTOKICK_TIMEOUT_MS,
);
const RELAYER_EXPECTED_VERIFIER_HASH_RAW =
  (ALLOW_TEST_OVERRIDES ? process.env.RELAYER_EXPECTED_VERIFIER_HASH : "") || DEFAULT_VERIFIER_HASH;
const RELAYER_EXPECTED_VERIFIER_HASH = normalizeOptionalHash160Env(RELAYER_EXPECTED_VERIFIER_HASH_RAW);
const RELAYER_MERKLE_MAX_BOOTSTRAP_LEAVES = parsePositiveIntEnv(
  ALLOW_TEST_OVERRIDES ? process.env.RELAYER_MERKLE_MAX_BOOTSTRAP_LEAVES : undefined,
  MERKLE_MAX_BOOTSTRAP_LEAVES,
);
const KV_REST_API_URL = process.env.KV_REST_API_URL || "";
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || "";
const HAS_DURABLE_GUARD_CONFIG = Boolean(KV_REST_API_URL && KV_REST_API_TOKEN);
const GUARD_STORE_MODE: GuardStoreMode = HAS_DURABLE_GUARD_CONFIG ? "durable" : "memory";
const redisClient = HAS_DURABLE_GUARD_CONFIG ? new Redis({ url: KV_REST_API_URL, token: KV_REST_API_TOKEN }) : null;

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const nullifierLocks = new Map<string, number>();
const maintainerKickStore = new Map<string, number>();
const tokenAllowlist = parseTokenAllowlist(ALLOWED_TOKEN_HASHES);
const originAllowlist = parseOriginAllowlist(RELAYER_ALLOWED_ORIGINS);

let cachedNetworkMagic: { value: number; expiresAt: number } | null = null;
let snarkjsPromise: Promise<SnarkjsLike> | null = null;
let cachedMerkleTree: {
  leaves: bigint[];
  layers: bigint[][];
  root: bigint;
  leafCount: number;
} | null = null;
let cachedWeakVerifierProbe: { verifierHash: string; weak: boolean; expiresAt: number } | null = null;
const ZERO_HASHES = buildZeroHashes();

const relayConfigIssues = validateRelayConfig();

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

function parseBooleanEnv(raw: string | undefined, defaultValue: boolean): boolean {
  if (typeof raw !== "string") return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
  if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
  return defaultValue;
}

function parsePositiveIntEnv(raw: string | undefined, defaultValue: number): number {
  if (typeof raw !== "string") return defaultValue;
  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) return defaultValue;
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value <= 0) return defaultValue;
  return value;
}

function buildZeroHashes(): bigint[] {
  const hashes = [0n];
  for (let d = 0; d < TREE_DEPTH; d++) {
    hashes.push(poseidon2Bls([hashes[d], hashes[d]]));
  }
  return hashes;
}

function hasSecureRpcTransport(url: string): boolean {
  const value = url.trim();
  return /^https:\/\//i.test(value) || /^wss:\/\//i.test(value);
}

function hasInsecureOriginRule(allowlist: NonNullable<typeof originAllowlist>): boolean {
  for (const exactOrigin of allowlist.exact) {
    try {
      const url = new URL(exactOrigin);
      if (url.protocol !== "https:") {
        return true;
      }
    } catch {
      return true;
    }
  }

  return allowlist.wildcard.some((rule) => rule.protocol !== "https:");
}

function validateRelayConfig(): string[] {
  const issues: string[] = [];

  if (!RELAYER_ALLOW_INSECURE_RPC && !hasSecureRpcTransport(RPC_URL)) {
    issues.push("RPC_URL must use https:// or wss://.");
  }

  if (!RELAYER_WIF) issues.push("RELAYER_WIF is required.");
  if (!VAULT_HASH) issues.push("VAULT_HASH is required.");
  if (RELAYER_WIF) {
    try {
      // Validate key format early so misconfiguration fails closed.
      void new wallet.Account(RELAYER_WIF);
    } catch {
      issues.push("RELAYER_WIF is invalid.");
    }
  }
  if (VAULT_HASH) {
    try {
      void normalizeHash160(VAULT_HASH, "VAULT_HASH");
    } catch {
      issues.push("VAULT_HASH must be a valid 20-byte script hash.");
    }
  }
  if (RELAYER_EXPECTED_VERIFIER_HASH_RAW.trim().length > 0 && !RELAYER_EXPECTED_VERIFIER_HASH) {
    issues.push("RELAYER_EXPECTED_VERIFIER_HASH must be a valid 20-byte script hash.");
  }
  if (RELAYER_MERKLE_MAX_BOOTSTRAP_LEAVES > MERKLE_MAX_LEAVES_HARD_LIMIT) {
    issues.push(
      `RELAYER_MERKLE_MAX_BOOTSTRAP_LEAVES must be <= ${MERKLE_MAX_LEAVES_HARD_LIMIT} to protect relayer memory.`,
    );
  }
  if (ALLOWED_TOKEN_HASHES.trim().length > 0 && !tokenAllowlist) {
    issues.push("ALLOWED_TOKEN_HASHES is set but contains no valid script hashes.");
  }

  if (RELAYER_REQUIRE_ORIGIN_ALLOWLIST && !originAllowlist) {
    issues.push("RELAYER_ALLOWED_ORIGINS is required by relayer policy.");
  }
  if (originAllowlist && hasInsecureOriginRule(originAllowlist)) {
    issues.push("RELAYER_ALLOWED_ORIGINS must use https:// origins.");
  }

  

  if (RELAYER_REQUIRE_DURABLE_GUARDS && GUARD_STORE_MODE !== "durable") {
    issues.push("Durable guard storage is required. Configure KV_REST_API_URL and KV_REST_API_TOKEN.");
  }
  if (IS_PRODUCTION && !tokenAllowlist) {
    issues.push("ALLOWED_TOKEN_HASHES must include at least one token in production.");
  }
  
  
  
  
  

  return issues;
}

function normalizeHash160(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!HASH160_HEX_RE.test(trimmed)) {
    throw new Error(`${fieldName} must be a valid 20-byte script hash`);
  }
  return trimmed.replace(/^0x/i, "").toLowerCase();
}

function normalizeOptionalHash160Env(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (!HASH160_HEX_RE.test(trimmed)) return null;
  return trimmed.replace(/^0x/i, "").toLowerCase();
}

function toScriptHash(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (wallet.isAddress(trimmed)) {
    return wallet.getScriptHashFromAddress(trimmed);
  }
  return normalizeHash160(trimmed, fieldName);
}

function normalizeHex32(value: string, fieldName: string): string {
  const normalized = value.trim().replace(/^0x/i, "").toLowerCase();
  if (!HEX32_RE.test(normalized)) {
    throw new Error(`${fieldName} must be a 32-byte hex value`);
  }
  return normalized;
}

function parseIntString(value: string, fieldName: string): bigint {
  const trimmed = value.trim();
  if (!INT_RE.test(trimmed)) {
    throw new Error(`${fieldName} must be an integer string`);
  }
  if (trimmed.length > MAX_PUBLIC_INPUT_DECIMAL_LENGTH) {
    throw new Error(`${fieldName} exceeds 32-byte scalar range`);
  }
  const parsed = BigInt(trimmed);
  if (parsed > MAX_UINT256) {
    throw new Error(`${fieldName} exceeds 32-byte scalar range`);
  }
  return parsed;
}

function normalizePublicInput(value: unknown, index: number): string {
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`publicInputs[${index}] must be numeric`);
  }
  const raw = `${value}`.trim();
  if (raw.length > MAX_PUBLIC_INPUT_DECIMAL_LENGTH) {
    throw new Error(`publicInputs[${index}] is too large`);
  }
  if (!INT_RE.test(raw)) {
    throw new Error(`publicInputs[${index}] must be non-negative integer`);
  }
  const parsed = BigInt(raw);
  if (parsed > MAX_UINT256) {
    throw new Error(`publicInputs[${index}] exceeds 32-byte scalar range`);
  }
  return parsed.toString();
}

function toBase64Hex(hex: string): string {
  return Buffer.from(hex, "hex").toString("base64");
}

function parseTokenAllowlist(raw: string): Set<string> | null {
  const entries = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => HASH160_HEX_RE.test(item))
    .map((item) => item.replace(/^0x/i, "").toLowerCase());

  if (entries.length === 0) return null;
  return new Set(entries);
}

function configIssueResponse(statusCode = 503): NextResponse | null {
  if (relayConfigIssues.length === 0) return null;
  return NextResponse.json(
    { error: "Relayer is not fully configured.", issues: relayConfigIssues },
    { status: statusCode },
  );
}

function parseMaintainerStatus(raw: unknown): MaintainerStatusSnapshot | null {
  const source =
    typeof raw === "string"
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;
  if (!source || typeof source !== "object") return null;

  const candidate = source as Record<string, unknown>;
  const state = typeof candidate.state === "string" ? candidate.state.trim().toLowerCase() : "";
  if (!state) return null;

  const updatedAt = typeof candidate.updatedAt === "string" ? candidate.updatedAt : undefined;
  if (updatedAt) {
    const updatedAtMs = Date.parse(updatedAt);
    if (Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs > MAINTAINER_STATUS_MAX_AGE_MS) {
      return null;
    }
  }

  const stage = typeof candidate.stage === "string" ? candidate.stage.trim().toLowerCase() : undefined;
  const durationMs =
    typeof candidate.durationMs === "number" && Number.isFinite(candidate.durationMs) && candidate.durationMs >= 0
      ? candidate.durationMs
      : undefined;
  const remainingLeaves =
    typeof candidate.remainingLeaves === "number" && Number.isFinite(candidate.remainingLeaves)
      ? Math.max(0, Math.floor(candidate.remainingLeaves))
      : undefined;
  const leavesProcessed =
    typeof candidate.leavesProcessed === "number" && Number.isFinite(candidate.leavesProcessed)
      ? Math.max(0, Math.floor(candidate.leavesProcessed))
      : undefined;
  const currentLeaves =
    typeof candidate.currentLeaves === "number" && Number.isFinite(candidate.currentLeaves)
      ? Math.max(0, Math.floor(candidate.currentLeaves))
      : undefined;

  return {
    state,
    stage,
    runId: typeof candidate.runId === "string" ? candidate.runId : undefined,
    startedAt: typeof candidate.startedAt === "string" ? candidate.startedAt : undefined,
    updatedAt,
    finishedAt: typeof candidate.finishedAt === "string" ? candidate.finishedAt : undefined,
    durationMs,
    error: typeof candidate.error === "string" ? candidate.error : undefined,
    txid: typeof candidate.txid === "string" ? candidate.txid : undefined,
    newRoot: typeof candidate.newRoot === "string" ? candidate.newRoot : undefined,
    leavesProcessed,
    remainingLeaves,
    currentLeaves,
  };
}

async function readMaintainerStatus(vaultScriptHash: string): Promise<MaintainerStatusSnapshot | null> {
  if (!redisClient) return null;
  const key = `${MAINTAINER_STATUS_KEY_PREFIX}${vaultScriptHash}`;
  try {
    const raw = await redisClient.get<unknown>(key);
    return parseMaintainerStatus(raw);
  } catch {
    return null;
  }
}

function getMaintainerHint(status: MaintainerStatusSnapshot | null): string | null {
  if (!status || !status.state) return null;
  const state = status.state.toLowerCase();
  const stage = (status.stage || "").toLowerCase();

  if (state === "queued" || stage === "queued") {
    return "Maintainer update is queued for prover execution. Finalization should continue once the worker picks it up.";
  }
  if (state === "running" && stage === "proof_generation") {
    return "Maintainer is generating the tree-update proof. This can take a few minutes on testnet.";
  }
  if (state === "running" && stage === "submitting_root_update") {
    return "Maintainer generated the proof and is submitting the root update transaction.";
  }
  if (state === "failed" && status.error) {
    return `Maintainer last failed attempt: ${status.error}`;
  }
  if (state === "success") {
    return "Maintainer recently finalized a root. Proof lookup should succeed after chain/index refresh.";
  }
  if (state === "up_to_date") {
    return "Maintainer reports tree is up to date. If this persists, verify your commitment index and root state.";
  }
  return null;
}

function isOriginAuthorized(headers: Headers, requestUrl: string): boolean {
  if (isOriginAllowed(headers, originAllowlist)) {
    return true;
  }

  try {
    const requestOrigin = new URL(requestUrl).origin;

    const originHeader = headers.get("origin");
    if (originHeader) {
      const callerOrigin = new URL(originHeader).origin;
      if (callerOrigin === requestOrigin) {
        return true;
      }
    }

    const refererHeader = headers.get("referer");
    if (refererHeader) {
      const refererOrigin = new URL(refererHeader).origin;
      if (refererOrigin === requestOrigin) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function exposeErrorMessage(error: unknown, fallback: string): string {
  const rawMessage = error instanceof Error ? error.message : "";
  const normalized = rawMessage.toLowerCase();

  if (
    normalized.includes("called contract") &&
    normalized.includes("not found")
  ) {
    return "Vault contract not found on configured RPC. Check VAULT_HASH and RPC_URL.";
  }
  if (normalized.includes("unknown contract")) {
    return "Vault contract not found on configured RPC. Check VAULT_HASH and RPC_URL.";
  }
  if (
    normalized.includes("network request failed") ||
    normalized.includes("fetch failed") ||
    normalized.includes("timed out") ||
    normalized.includes("timeout")
  ) {
    return "RPC endpoint is unreachable. Check RPC_URL and network connectivity.";
  }

  if (IS_PRODUCTION) {
    return fallback;
  }
  return rawMessage || fallback;
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = createHash("sha256").update(left, "utf8").digest();
  const rightBuffer = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftBuffer, rightBuffer);
}

async function readJsonBodyWithLimit<T>(req: Request, maxBytes: number): Promise<T> {
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    throw new Error("Content-Type must be application/json.");
  }
  const body = req.body;
  if (!body) {
    throw new Error("Invalid JSON body.");
  }
  const reader = body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value && value.byteLength > 0) {
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error("Request body too large.");
      }
      chunks.push(Buffer.from(value));
    }
  }
  const raw = Buffer.concat(chunks).toString("utf8");

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error("Invalid JSON body.");
  }
}

function pruneRateLimitStore(now: number): void {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }

  while (rateLimitStore.size > RATE_LIMIT_MAX_TRACKED_KEYS) {
    const oldestKey = rateLimitStore.keys().next().value as string | undefined;
    if (!oldestKey) break;
    rateLimitStore.delete(oldestKey);
  }
}

function isRateLimitedInMemory(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  pruneRateLimitStore(now);
  const current = rateLimitStore.get(key);

  if (!current) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }

  if (current.count >= maxRequests) {
    return true;
  }

  current.count += 1;
  rateLimitStore.set(key, current);
  return false;
}

async function isRateLimitedDurable(key: string, maxRequests: number, windowMs: number): Promise<boolean> {
  if (!redisClient) {
    throw new Error("Durable guard storage is unavailable.");
  }
  const seconds = Math.ceil(windowMs / 1000);
  const counterKey = `znep17:rate:${key}`;
  const count = await redisClient.incr(counterKey);
  if (count === 1) {
    await redisClient.expire(counterKey, seconds);
  }
  return Number(count) > maxRequests;
}

async function isRateLimited(key: string, maxRequests = RATE_MAX_REQUESTS, windowMs = RATE_WINDOW_MS): Promise<boolean> {
  if (GUARD_STORE_MODE === "durable") {
    return isRateLimitedDurable(key, maxRequests, windowMs);
  }
  return isRateLimitedInMemory(key, maxRequests, windowMs);
}

function cleanMaintainerKickStore(now: number): void {
  for (const [key, expiresAt] of maintainerKickStore.entries()) {
    if (expiresAt <= now) {
      maintainerKickStore.delete(key);
    }
  }
}

function shouldKickMaintainerInMemory(vaultScriptHash: string, intervalMs: number): boolean {
  const now = Date.now();
  cleanMaintainerKickStore(now);
  const key = `vault:${vaultScriptHash}`;
  const existing = maintainerKickStore.get(key);
  if (typeof existing === "number" && existing > now) {
    return false;
  }
  maintainerKickStore.set(key, now + intervalMs);
  return true;
}

async function shouldKickMaintainer(vaultScriptHash: string): Promise<boolean> {
  if (RELAYER_MAINTAINER_AUTOKICK_INTERVAL_MS <= 0) {
    return false;
  }

  if (GUARD_STORE_MODE === "durable" && redisClient) {
    const key = `znep17:maintainer-kick:${vaultScriptHash}`;
    try {
      const result = await redisClient.set(key, "1", {
        nx: true,
        px: RELAYER_MAINTAINER_AUTOKICK_INTERVAL_MS,
      });
      return result === "OK";
    } catch {
      return shouldKickMaintainerInMemory(vaultScriptHash, RELAYER_MAINTAINER_AUTOKICK_INTERVAL_MS);
    }
  }

  return shouldKickMaintainerInMemory(vaultScriptHash, RELAYER_MAINTAINER_AUTOKICK_INTERVAL_MS);
}

async function kickMaintainerAsync(req: Request, vaultScriptHash: string): Promise<void> {
  if (!RELAYER_ENABLE_MAINTAINER_AUTOKICK) {
    return;
  }
  const shouldKick = await shouldKickMaintainer(vaultScriptHash);
  if (!shouldKick) {
    return;
  }

  const maintainerUrl = new URL("/api/maintainer", req.url);
  const headers = new Headers({
    origin: maintainerUrl.origin,
    referer: `${maintainerUrl.origin}/api/relay`,
  });
  if (RELAYER_API_KEY.trim().length > 0) {
    headers.set("x-relayer-api-key", RELAYER_API_KEY.trim());
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => {
    controller.abort();
  }, RELAYER_MAINTAINER_AUTOKICK_TIMEOUT_MS);
  try {
    await fetch(maintainerUrl.toString(), {
      method: "POST",
      headers,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (error: unknown) {
    const errorName = error instanceof Error ? error.name : "";
    if (errorName !== "AbortError") {
      console.error("Maintainer auto-kick failed:", error instanceof Error ? error.message : String(error));
    }
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function cleanNullifierLocks(now: number): void {
  for (const [key, expiresAt] of nullifierLocks.entries()) {
    if (expiresAt <= now) {
      nullifierLocks.delete(key);
    }
  }
}

function acquireNullifierLockInMemory(nullifierHex: string): boolean {
  const now = Date.now();
  cleanNullifierLocks(now);
  const existing = nullifierLocks.get(nullifierHex);
  if (typeof existing === "number" && existing > now) {
    return false;
  }
  nullifierLocks.set(nullifierHex, now + NULLIFIER_LOCK_TTL_MS);
  return true;
}

function releaseNullifierLockInMemory(nullifierHex: string): void {
  nullifierLocks.delete(nullifierHex);
}

async function acquireNullifierLockDurable(nullifierHex: string): Promise<boolean> {
  if (!redisClient) {
    throw new Error("Durable guard storage is unavailable.");
  }
  const key = `znep17:nullifier-lock:${nullifierHex}`;
  const result = await redisClient.set(key, "1", { nx: true, px: NULLIFIER_LOCK_TTL_MS });
  return result === "OK";
}

async function releaseNullifierLockDurable(nullifierHex: string): Promise<void> {
  if (!redisClient) {
    return;
  }
  const key = `znep17:nullifier-lock:${nullifierHex}`;
  await redisClient.del(key);
}

async function acquireNullifierLock(nullifierHex: string): Promise<boolean> {
  if (GUARD_STORE_MODE === "durable") {
    return acquireNullifierLockDurable(nullifierHex);
  }
  return acquireNullifierLockInMemory(nullifierHex);
}

async function releaseNullifierLock(nullifierHex: string): Promise<void> {
  if (GUARD_STORE_MODE === "durable") {
    await releaseNullifierLockDurable(nullifierHex);
    return;
  }
  releaseNullifierLockInMemory(nullifierHex);
}

async function safeReleaseNullifierLock(nullifierHex: string): Promise<void> {
  try {
    await releaseNullifierLock(nullifierHex);
  } catch (error: unknown) {
    console.error(
      "Failed to release nullifier lock:",
      error instanceof Error ? error.message : "unknown release failure",
    );
  }
}

function parseRpcBool(value: unknown): boolean {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
    if (INT_RE.test(value)) return BigInt(value) !== 0n;
  }
  if (typeof value === "number") return value !== 0;
  return false;
}

function parseRpcByteArrayHex(item: RpcStackItem, fieldName: string): string {
  if (item.type !== "ByteString" && item.type !== "Buffer" && item.type !== "ByteArray") {
    throw new Error(`${fieldName} must be a byte string`);
  }
  if (typeof item.value !== "string") {
    throw new Error(`${fieldName} is missing byte value`);
  }
  return Buffer.from(item.value, "base64").toString("hex");
}

async function getNetworkMagic(): Promise<number> {
  const now = Date.now();
  if (cachedNetworkMagic && cachedNetworkMagic.expiresAt > now) {
    return cachedNetworkMagic.value;
  }

  const client = new rpc.RPCClient(RPC_URL);
  const version = await client.getVersion();
  const network = version?.protocol?.network;
  if (typeof network !== "number" || !Number.isInteger(network) || network <= 0) {
    throw new Error("Unable to resolve network magic from RPC endpoint");
  }

  cachedNetworkMagic = {
    value: network,
    expiresAt: now + NETWORK_MAGIC_CACHE_MS,
  };
  return network;
}

async function loadSnarkjs(): Promise<SnarkjsLike> {
  if (!snarkjsPromise) {
    snarkjsPromise = import("snarkjs") as unknown as Promise<SnarkjsLike>;
  }
  return snarkjsPromise;
}

async function fetchLeafIndexOnChain(vaultScriptHash: string): Promise<number> {
  const client = new rpc.RPCClient(RPC_URL);
  let result;
  try {
    result = await client.invokeFunction(`0x${vaultScriptHash}`, "getLeafIndex", []);
  } catch {
    result = await client.invokeFunction(`0x${vaultScriptHash}`, "GetLeafIndex", []);
  }
  if (result.state === "FAULT") {
    throw new Error(`getLeafIndex failed: ${result.exception || "unknown"}`);
  }
  const item = result.stack?.[0] as RpcStackItem | undefined;
  if (!item || !item.value) return 0;
  if (item.type === "Integer") return Number(item.value);
  if (item.type === "ByteString" || item.type === "ByteArray" || item.type === "Buffer") {
    const hex = Buffer.from(String(item.value), "base64").toString("hex");
    if (hex.length === 0) return 0;
    return Number(BigInt(`0x${hex}`));
  }
  return 0;
}

async function fetchLastRootLeafCountOnChain(vaultScriptHash: string): Promise<number> {
  const client = new rpc.RPCClient(RPC_URL);
  let result;
  try {
    result = await client.invokeFunction(`0x${vaultScriptHash}`, "getLastRootLeafCount", []);
  } catch {
    result = await client.invokeFunction(`0x${vaultScriptHash}`, "GetLastRootLeafCount", []);
  }
  if (result.state === "FAULT") {
    throw new Error(`getLastRootLeafCount failed: ${result.exception || "unknown"}`);
  }
  const item = result.stack?.[0] as RpcStackItem | undefined;
  if (!item || !item.value) return 0;
  if (item.type === "Integer") return Number(item.value);
  if (item.type === "ByteString" || item.type === "ByteArray" || item.type === "Buffer") {
    const hex = Buffer.from(String(item.value), "base64").toString("hex");
    if (hex.length === 0) return 0;
    return Number(BigInt(`0x${hex}`));
  }
  return 0;
}

async function fetchLeafOnChain(vaultScriptHash: string, index: number): Promise<string> {
  const client = new rpc.RPCClient(RPC_URL);
  let result;
  try {
    result = await client.invokeFunction(`0x${vaultScriptHash}`, "getLeaf", [
      sc.ContractParam.integer(index.toString()),
    ]);
  } catch {
    result = await client.invokeFunction(`0x${vaultScriptHash}`, "GetLeaf", [
      sc.ContractParam.integer(index.toString()),
    ]);
  }
  if (result.state === "FAULT") {
    throw new Error(`getLeaf(${index}) failed: ${result.exception || "unknown"}`);
  }
  const item = result.stack?.[0] as RpcStackItem | undefined;
  if (!item) return "";
  return parseRpcByteArrayHex(item, `leaf[${index}]`);
}

async function callVaultBoolMethod(vaultScriptHash: string, operation: string, inputHex32: string): Promise<boolean> {
  const client = new rpc.RPCClient(RPC_URL);
  const result = await client.invokeFunction(`0x${vaultScriptHash}`, operation, [
    sc.ContractParam.byteArray(toBase64Hex(inputHex32)),
  ]);
  if (result.state === "FAULT") {
    throw new Error(`Vault precheck ${operation} failed: ${result.exception || "unknown fault"}`);
  }

  const value = (result.stack && result.stack[0] && (result.stack[0] as RpcStackItem).value) || false;
  return parseRpcBool(value);
}

async function callVaultByteMethod(vaultScriptHash: string, operation: string): Promise<string> {
  const client = new rpc.RPCClient(RPC_URL);
  const result = await client.invokeFunction(`0x${vaultScriptHash}`, operation, []);
  if (result.state === "FAULT") {
    throw new Error(`Vault read ${operation} failed: ${result.exception || "unknown fault"}`);
  }

  const item = (result.stack && result.stack[0]) as RpcStackItem | undefined;
  if (!item) {
    throw new Error(`Vault read ${operation} returned empty stack`);
  }
  return parseRpcByteArrayHex(item, operation);
}

async function callVaultIntegerMethod(vaultScriptHash: string, operation: string, inputHex32: string): Promise<number> {
  const client = new rpc.RPCClient(RPC_URL);
  const result = await client.invokeFunction(`0x${vaultScriptHash}`, operation, [
    sc.ContractParam.byteArray(toBase64Hex(inputHex32)),
  ]);
  if (result.state === "FAULT") {
    throw new Error(`Vault read ${operation} failed: ${result.exception || "unknown fault"}`);
  }
  const item = result.stack?.[0] as RpcStackItem | undefined;
  if (!item) {
    return -1;
  }
  if (item.type === "Integer") {
    return Number(item.value);
  }
  if (item.type === "ByteString" || item.type === "ByteArray" || item.type === "Buffer") {
    const hex = Buffer.from(String(item.value), "base64").toString("hex");
    if (hex.length === 0) return 0;
    return Number(BigInt(`0x${hex}`));
  }
  return -1;
}

async function callVaultHash160Method(vaultScriptHash: string, operation: string): Promise<string> {
  const value = await callVaultByteMethod(vaultScriptHash, operation);
  if (value.length === 0) {
    return ZERO_HASH160;
  }
  if (!HASH160_HEX_RE.test(value)) {
    throw new Error(`Vault read ${operation} returned invalid hash160`);
  }
  return u.reverseHex(value.toLowerCase());
}

async function isNullifierUsedOnChain(vaultScriptHash: string, nullifierHex: string): Promise<boolean> {
  try {
    return await callVaultBoolMethod(vaultScriptHash, "isNullifierUsed", nullifierHex);
  } catch {
    return await callVaultBoolMethod(vaultScriptHash, "IsNullifierUsed", nullifierHex);
  }
}

async function isKnownRootOnChain(vaultScriptHash: string, rootHex: string): Promise<boolean> {
  try {
    return await callVaultBoolMethod(vaultScriptHash, "isKnownRoot", rootHex);
  } catch {
    return await callVaultBoolMethod(vaultScriptHash, "IsKnownRoot", rootHex);
  }
}

async function getCurrentRootOnChain(vaultScriptHash: string): Promise<string | null> {
  let rootHex: string;
  try {
    rootHex = await callVaultByteMethod(vaultScriptHash, "getCurrentRoot");
  } catch {
    rootHex = await callVaultByteMethod(vaultScriptHash, "GetCurrentRoot");
  }

  if (rootHex.length === 0) {
    return null;
  }
  if (!HEX32_RE.test(rootHex)) {
    throw new Error("Vault current root is not 32 bytes");
  }
  return rootHex;
}

async function getCommitmentIndexOnChain(vaultScriptHash: string, commitmentHex: string): Promise<number> {
  try {
    return await callVaultIntegerMethod(vaultScriptHash, "getCommitmentIndex", commitmentHex);
  } catch {
    return await callVaultIntegerMethod(vaultScriptHash, "GetCommitmentIndex", commitmentHex);
  }
}

async function getVerifierOnChain(vaultScriptHash: string): Promise<string> {
  try {
    return await callVaultHash160Method(vaultScriptHash, "getVerifier");
  } catch {
    return await callVaultHash160Method(vaultScriptHash, "GetVerifier");
  }
}

function buildMerkleLayers(leaves: bigint[]): bigint[][] {
  const layers: bigint[][] = [];
  layers.push(leaves.slice());

  let current = layers[0];
  for (let d = 0; d < TREE_DEPTH; d++) {
    const nextLength = Math.max(1, Math.ceil(current.length / 2));
    const next = new Array<bigint>(nextLength);
    for (let j = 0; j < nextLength; j++) {
      const left = current[j * 2] ?? ZERO_HASHES[d];
      const right = current[j * 2 + 1] ?? ZERO_HASHES[d];
      next[j] = poseidon2Bls([left, right]);
    }
    layers.push(next);
    current = next;
  }

  return layers;
}

async function fetchLeavesRangeOnChain(vaultScriptHash: string, fromInclusive: number, toExclusive: number): Promise<bigint[]> {
  const values: bigint[] = [];
  const BATCH_SIZE = 32;
  for (let start = fromInclusive; start < toExclusive; start += BATCH_SIZE) {
    const end = Math.min(toExclusive, start + BATCH_SIZE);
    const batch = [];
    for (let i = start; i < end; i++) {
      batch.push(fetchLeafOnChain(vaultScriptHash, i));
    }
    const hexLeaves = await Promise.all(batch);
    for (const hex of hexLeaves) {
      values.push(hex.length > 0 ? BigInt(`0x${hex}`) : 0n);
    }
  }
  return values;
}

function appendLeafToMerkleTree(tree: { leaves: bigint[]; layers: bigint[][]; root: bigint; leafCount: number }, leaf: bigint): void {
  const leafIndex = tree.leafCount;
  tree.leaves.push(leaf);
  tree.layers[0][leafIndex] = leaf;

  let idx = leafIndex;
  let currentHash = leaf;
  for (let depth = 0; depth < TREE_DEPTH; depth++) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = tree.layers[depth][siblingIdx] ?? ZERO_HASHES[depth];
    const parentHash = idx % 2 === 0 ? poseidon2Bls([currentHash, sibling]) : poseidon2Bls([sibling, currentHash]);
    idx = Math.floor(idx / 2);
    tree.layers[depth + 1][idx] = parentHash;
    currentHash = parentHash;
  }

  tree.root = currentHash;
  tree.leafCount += 1;
}

async function getOrBuildMerkleTree(vaultScriptHash: string, targetLeafCount?: number): Promise<{
  leaves: bigint[];
  layers: bigint[][];
  root: bigint;
  leafCount: number;
}> {
  const leafCount = typeof targetLeafCount === "number"
    ? targetLeafCount
    : await fetchLeafIndexOnChain(vaultScriptHash);
  if (leafCount > RELAYER_MERKLE_MAX_BOOTSTRAP_LEAVES) {
    throw new Error(
      `Merkle tree size exceeds configured limit (${leafCount} > ${RELAYER_MERKLE_MAX_BOOTSTRAP_LEAVES}).`,
    );
  }

  if (!cachedMerkleTree || leafCount < cachedMerkleTree.leafCount) {
    const leaves = await fetchLeavesRangeOnChain(vaultScriptHash, 0, leafCount);
    const layers = buildMerkleLayers(leaves);
    cachedMerkleTree = {
      leaves,
      layers,
      root: layers[TREE_DEPTH][0] ?? ZERO_HASHES[TREE_DEPTH],
      leafCount,
    };
    return cachedMerkleTree;
  }

  if (leafCount > cachedMerkleTree.leafCount) {
    const newLeaves = await fetchLeavesRangeOnChain(vaultScriptHash, cachedMerkleTree.leafCount, leafCount);
    for (const leaf of newLeaves) {
      appendLeafToMerkleTree(cachedMerkleTree, leaf);
    }
  }

  return cachedMerkleTree;
}

function computeMerkleProof(layers: bigint[][], leafIndex: number): { pathElements: string[]; pathIndices: number[] } {
  const pathElements: string[] = [];
  const pathIndices: number[] = [];
  let idx = leafIndex;

  for (let d = 0; d < TREE_DEPTH; d++) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = layers[d][siblingIdx] ?? ZERO_HASHES[d];
    pathElements.push(sibling.toString());
    pathIndices.push(idx % 2);
    idx = Math.floor(idx / 2);
  }

  return { pathElements, pathIndices };
}

async function isWeakOnChainVerifier(
  verifierHash: string,
  assetHash: string,
  merkleRootHex: string,
  nullifierHashHex: string,
  commitmentHex: string,
  recipientScriptHash: string,
  relayerScriptHash: string,
): Promise<boolean> {
  const now = Date.now();
  if (
    cachedWeakVerifierProbe &&
    cachedWeakVerifierProbe.verifierHash === verifierHash &&
    cachedWeakVerifierProbe.expiresAt > now
  ) {
    return cachedWeakVerifierProbe.weak;
  }

  const client = new rpc.RPCClient(RPC_URL);
  let weak = false;
  try {
    const probeResult = await client.invokeFunction(`0x${verifierHash}`, "verify", [
      sc.ContractParam.hash160(assetHash),
      sc.ContractParam.byteArray(toBase64Hex("01")),
      sc.ContractParam.byteArray(Buffer.from("[\"1\"]", "utf8").toString("base64")),
      sc.ContractParam.byteArray(toBase64Hex(merkleRootHex)),
      sc.ContractParam.byteArray(toBase64Hex(nullifierHashHex)),
      sc.ContractParam.byteArray(toBase64Hex(commitmentHex)),
      sc.ContractParam.hash160(recipientScriptHash),
      sc.ContractParam.hash160(relayerScriptHash),
      sc.ContractParam.integer("2"),
      sc.ContractParam.integer("1"),
    ]);
    const value = (probeResult.stack && probeResult.stack[0] && (probeResult.stack[0] as RpcStackItem).value) || false;
    weak = probeResult.state !== "FAULT" && parseRpcBool(value);
  } catch {
    weak = false;
  }

  cachedWeakVerifierProbe = {
    verifierHash,
    weak,
    expiresAt: now + VERIFIER_PROBE_CACHE_MS,
  };
  return weak;
}

export async function GET(req: Request) {
  const configError = configIssueResponse();
  if (configError) {
    return NextResponse.json(
      {
        configured: false,
        error: "Relayer is not fully configured.",
        issues: relayConfigIssues,
        proofMode: RELAYER_PROOF_MODE,
        guardStoreMode: GUARD_STORE_MODE,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const vaultScriptHash = normalizeHash160(VAULT_HASH, "VAULT_HASH");
    const url = new URL(req.url);
    const proofCommitment = url.searchParams.get("proof");
    const proofMode = (url.searchParams.get("mode") || "").trim().toLowerCase();
    const softProofMode = proofMode === "soft";

    if (proofCommitment) {
      const ip = getClientIpFromHeaders(req.headers, {
        isVercelRuntime: process.env.VERCEL === "1",
        trustProxyHeaders: RELAYER_TRUST_PROXY_HEADERS,
      });
      let limited = false;
      try {
        limited = await isRateLimited(`proof:${ip}`, PROOF_RATE_MAX_REQUESTS, RATE_WINDOW_MS);
      } catch {
        return NextResponse.json({ error: "Rate limiter unavailable. Retry later." }, { status: 503 });
      }
      if (limited) {
        return NextResponse.json({ error: "Too many proof requests. Retry later." }, { status: 429 });
      }
      if (!isOriginAuthorized(req.headers, req.url)) {
        return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
      }
      if (RELAYER_REQUIRE_AUTH) {
        const clientApiKey = readApiCredential(req.headers);
        if (!clientApiKey || !constantTimeEquals(clientApiKey, RELAYER_API_KEY)) {
          return NextResponse.json({ error: "Missing or invalid relayer API key." }, { status: 401 });
        }
      }

      let commitmentHex: string;
      try {
        commitmentHex = normalizeHex32(proofCommitment, "proof commitment");
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Invalid proof commitment.";
        return NextResponse.json({ error: message }, { status: 400 });
      }
      const commitmentIndex = await getCommitmentIndexOnChain(vaultScriptHash, commitmentHex);
      if (commitmentIndex < 0) {
        return NextResponse.json(
          { error: "Commitment not found in tree." },
          { status: 404, headers: { "Cache-Control": "no-store" } },
        );
      }
      const [leafCount, lastRootLeafCount] = await Promise.all([
        fetchLeafIndexOnChain(vaultScriptHash),
        fetchLastRootLeafCountOnChain(vaultScriptHash),
      ]);
      if (lastRootLeafCount > leafCount) {
        return NextResponse.json(
          { error: "Invalid vault state: finalized root leaf count exceeds total leaves." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
      if (commitmentIndex >= lastRootLeafCount) {
        void kickMaintainerAsync(req, vaultScriptHash);
        const message = "Commitment is not yet included in a finalized Merkle root. Retry shortly.";
        const maintainerStatus = await readMaintainerStatus(vaultScriptHash);
        const maintainerHint = getMaintainerHint(maintainerStatus);
        if (softProofMode) {
          return NextResponse.json(
            {
              pendingFinalization: true,
              error: message,
              commitmentIndex,
              lastRootLeafCount,
              leafCount,
              maintainerStatus,
              ...(maintainerHint ? { maintainerHint } : {}),
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        }
        return NextResponse.json(
          { error: message, ...(maintainerHint ? { maintainerHint } : {}) },
          { status: 409, headers: { "Cache-Control": "no-store" } },
        );
      }

      const tree = await getOrBuildMerkleTree(vaultScriptHash, lastRootLeafCount);
      if (commitmentIndex >= tree.leafCount) {
        return NextResponse.json(
          { error: "Commitment index exceeds current tree size." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }
      const target = BigInt(`0x${commitmentHex}`);
      const treeLeaf = tree.layers[0][commitmentIndex] ?? 0n;
      if (treeLeaf !== target) {
        cachedMerkleTree = null;
        const rebuilt = await getOrBuildMerkleTree(vaultScriptHash, lastRootLeafCount);
        const rebuiltLeaf = rebuilt.layers[0][commitmentIndex] ?? 0n;
        if (rebuiltLeaf !== target) {
          return NextResponse.json(
            { error: "Commitment index mismatch with rebuilt Merkle tree." },
            { status: 404, headers: { "Cache-Control": "no-store" } },
          );
        }
        const proof = computeMerkleProof(rebuilt.layers, commitmentIndex);
        const rootHex = rebuilt.root.toString(16).padStart(64, "0");
        return NextResponse.json(
          {
            leafIndex: commitmentIndex,
            root: rootHex,
            rootDecimal: rebuilt.root.toString(),
            pathElements: proof.pathElements,
            pathIndices: proof.pathIndices,
            leafCount: rebuilt.leafCount,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      }

      const proof = computeMerkleProof(tree.layers, commitmentIndex);
      const rootHex = tree.root.toString(16).padStart(64, "0");

      return NextResponse.json(
        {
          leafIndex: commitmentIndex,
          root: rootHex,
          rootDecimal: tree.root.toString(),
          pathElements: proof.pathElements,
          pathIndices: proof.pathIndices,
          leafCount: tree.leafCount,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const relayerAccount = RELAYER_WIF ? new wallet.Account(RELAYER_WIF) : { address: 'Not Configured' };
    const [networkMagic, currentRoot] = await Promise.all([getNetworkMagic(), getCurrentRootOnChain(vaultScriptHash)]);

    return NextResponse.json(
      {
        configured: true,
        relayerAddress: relayerAccount.address,
        vaultHash: `0x${vaultScriptHash}`,
        currentRoot: currentRoot ? `0x${currentRoot}` : null,
        networkMagic,
        proofMode: RELAYER_PROOF_MODE,
        guardStoreMode: GUARD_STORE_MODE,
        requiresApiKey: RELAYER_REQUIRE_AUTH && RELAYER_API_KEY.length > 0,
        requiresStrongOnChainVerifier: RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER,
        expectedVerifierHash: RELAYER_EXPECTED_VERIFIER_HASH ? `0x${RELAYER_EXPECTED_VERIFIER_HASH}` : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        configured: false,
        error: exposeErrorMessage(error, "Failed to initialize relayer config."),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(req: Request) {
  let lockedNullifierHex: string | null = null;
  let keepNullifierLock = false;
  const unlockNullifier = async (): Promise<void> => {
    if (!lockedNullifierHex) return;
    await safeReleaseNullifierLock(lockedNullifierHex);
    lockedNullifierHex = null;
  };

  try {
    const configError = configIssueResponse();
    if (configError) {
      return configError;
    }

    const contentLengthHeader = req.headers.get("content-length");
    if (contentLengthHeader) {
      const contentLength = Number(contentLengthHeader);
      if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        return NextResponse.json({ error: "Request body too large." }, { status: 413 });
      }
    }

    const ip = getClientIpFromHeaders(req.headers, {
      isVercelRuntime: process.env.VERCEL === "1",
      trustProxyHeaders: RELAYER_TRUST_PROXY_HEADERS,
    });
    let limited = false;
    try {
      limited = await isRateLimited(ip);
    } catch {
      return NextResponse.json({ error: "Rate limiter unavailable. Retry later." }, { status: 503 });
    }
    if (limited) {
      return NextResponse.json({ error: "Too many requests. Retry later." }, { status: 429 });
    }
    if (!isOriginAuthorized(req.headers, req.url)) {
      return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
    }
    if (RELAYER_REQUIRE_AUTH) {
      const clientApiKey = readApiCredential(req.headers);
      if (!clientApiKey || !constantTimeEquals(clientApiKey, RELAYER_API_KEY)) {
        return NextResponse.json({ error: "Missing or invalid relayer API key." }, { status: 401 });
      }
    }

    let body: RelayRequestBody;
    try {
      body = await readJsonBodyWithLimit<RelayRequestBody>(req, MAX_BODY_BYTES);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid request body.";
      if (message === "Request body too large.") {
        return NextResponse.json({ error: message }, { status: 413 });
      }
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (
      typeof body?.tokenHash !== "string" ||
      typeof body?.merkleRoot !== "string" ||
      typeof body?.nullifierHash !== "string" ||
      typeof body?.commitment !== "string" ||
      typeof body?.newCommitment !== "string" ||
      typeof body?.recipient !== "string" ||
      typeof body?.relayer !== "string" ||
      typeof body?.amount !== "string" ||
      typeof body?.fee !== "string"
    ) {
      return NextResponse.json({ error: "Invalid request fields." }, { status: 400 });
    }

    if (!Array.isArray(body.publicInputs) || body.publicInputs.length !== MAX_PUBLIC_INPUT_COUNT) {
      return NextResponse.json(
        { error: `publicInputs must be an array with exactly ${MAX_PUBLIC_INPUT_COUNT} values.` },
        { status: 400 },
      );
    }

    if (!isGroth16Proof(body.proof)) {
      return NextResponse.json({ error: "Invalid proof payload." }, { status: 400 });
    }
    const proofJsonBytes = Buffer.byteLength(JSON.stringify(body.proof), "utf8");
    if (proofJsonBytes > MAX_PROOF_JSON_BYTES) {
      return NextResponse.json({ error: "Proof payload too large." }, { status: 413 });
    }

    let relayerAccount: InstanceType<typeof wallet.Account>;
    let serverRelayerScriptHash: string;
    let vaultScriptHash: string;
    let tokenScriptHash: string;
    let recipientScriptHash: string;
    let nullifierHashHex: string;
    let newCommitmentHex: string;
    let merkleRootHex: string;
    let amount: bigint;
    let fee: bigint;
    let normalizedPublicInputs: PublicSignals;
    let expectedPublicInputs: string[];
    try {
      relayerAccount = new wallet.Account(RELAYER_WIF);
      serverRelayerScriptHash = normalizeHash160(relayerAccount.scriptHash, "server relayer");
      vaultScriptHash = normalizeHash160(VAULT_HASH, "VAULT_HASH");

      tokenScriptHash = normalizeHash160(body.tokenHash, "tokenHash");
      if (tokenAllowlist && !tokenAllowlist.has(tokenScriptHash)) {
        return NextResponse.json({ error: "Token is not allowed by relayer policy." }, { status: 403 });
      }

      recipientScriptHash = toScriptHash(body.recipient, "recipient");
      const requestedRelayerScriptHash = toScriptHash(body.relayer, "relayer");
      if (requestedRelayerScriptHash !== serverRelayerScriptHash) {
        return NextResponse.json({ error: "Relayer mismatch." }, { status: 400 });
      }

      merkleRootHex = normalizeHex32(body.merkleRoot, "merkleRoot");
      nullifierHashHex = normalizeHex32(body.nullifierHash, "nullifierHash");
      newCommitmentHex = normalizeHex32(body.newCommitment, "newCommitment");
      amount = parseIntString(body.amount, "amount");
      fee = parseIntString(body.fee, "fee");

      normalizedPublicInputs = body.publicInputs.map((item, index) => normalizePublicInput(item, index));
      expectedPublicInputs = [
        BigInt(`0x${merkleRootHex}`).toString(),
        BigInt(`0x${nullifierHashHex}`).toString(),
        hash160ToFieldDecimal(recipientScriptHash),
        hash160ToFieldDecimal(serverRelayerScriptHash),
        fee.toString(),
        hash160ToFieldDecimal(tokenScriptHash),
        amount.toString(),
        BigInt(`0x${newCommitmentHex}`).toString(),
      ];
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid request fields.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    if (amount <= 0n) {
      return NextResponse.json({ error: "amount must be greater than zero." }, { status: 400 });
    }
    if (fee < MIN_FEE) {
      return NextResponse.json({ error: "Fee must be at least 1.0 (100000000)." }, { status: 400 });
    }
    if (amount <= fee) {
      return NextResponse.json({ error: "amount must be greater than fee." }, { status: 400 });
    }

    for (let i = 0; i < expectedPublicInputs.length; i++) {
      if (normalizedPublicInputs[i] !== expectedPublicInputs[i]) {
        return NextResponse.json({ error: `publicInputs mismatch at index ${i}.` }, { status: 400 });
      }
    }

    let lockAcquired = false;
    try {
      lockAcquired = await acquireNullifierLock(nullifierHashHex);
    } catch {
      return NextResponse.json({ error: "Replay guard unavailable. Retry later." }, { status: 503 });
    }
    if (!lockAcquired) {
      return NextResponse.json({ error: "Nullifier is already being processed." }, { status: 409 });
    }
    lockedNullifierHex = nullifierHashHex;

    const [knownRoot, usedNullifier, commitmentIndex] = await Promise.all([
      isKnownRootOnChain(vaultScriptHash, merkleRootHex),
      isNullifierUsedOnChain(vaultScriptHash, nullifierHashHex),
      getCommitmentIndexOnChain(vaultScriptHash, newCommitmentHex),
    ]);
    if (!knownRoot) {
      await unlockNullifier();
      return NextResponse.json({ error: "Unknown merkle root." }, { status: 400 });
    }
    if (commitmentIndex >= 0) {
      await unlockNullifier();
      return NextResponse.json({ error: "New commitment already exists in vault tree." }, { status: 409 });
    }
    if (usedNullifier) {
      await unlockNullifier();
      return NextResponse.json({ error: "Nullifier already used." }, { status: 409 });
    }

    if (RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER) {
      const verifierHash = await getVerifierOnChain(vaultScriptHash);
      if (verifierHash === ZERO_HASH160) {
        await unlockNullifier();
        return NextResponse.json({ error: "Vault verifier is not configured." }, { status: 503 });
      }
      if (RELAYER_EXPECTED_VERIFIER_HASH && verifierHash !== RELAYER_EXPECTED_VERIFIER_HASH) {
        await unlockNullifier();
        return NextResponse.json(
          { error: "Vault verifier hash does not match RELAYER_EXPECTED_VERIFIER_HASH." },
          { status: 503 },
        );
      }
      const weakVerifier = await isWeakOnChainVerifier(
        verifierHash,
        tokenScriptHash,
        merkleRootHex,
        nullifierHashHex,
        newCommitmentHex,
        recipientScriptHash,
        serverRelayerScriptHash,
      );
      if (weakVerifier) {
        await unlockNullifier();
        return NextResponse.json(
          { error: "On-chain verifier appears to accept invalid sentinel proofs. Refusing relay." },
          { status: 503 },
        );
      }
    }

    const snarkjs = await loadSnarkjs();
    const isValid = await snarkjs.groth16.verify(vKey, normalizedPublicInputs, body.proof as Groth16Proof);
    if (!isValid) {
      await unlockNullifier();
      return NextResponse.json({ error: "Invalid Zero-Knowledge Proof." }, { status: 400 });
    }

    const proofPayload = await encodeGroth16ProofPayload(body.proof);
    const publicInputsPayload = encodePublicInputsPayload(normalizedPublicInputs);

    const args = [
      sc.ContractParam.hash160(tokenScriptHash),
      sc.ContractParam.byteArray(proofPayload),
      sc.ContractParam.byteArray(publicInputsPayload),
      sc.ContractParam.byteArray(toBase64Hex(merkleRootHex)),
      sc.ContractParam.byteArray(toBase64Hex(nullifierHashHex)),
      sc.ContractParam.byteArray(toBase64Hex(newCommitmentHex)),
      sc.ContractParam.hash160(recipientScriptHash),
      sc.ContractParam.hash160(serverRelayerScriptHash),
      sc.ContractParam.integer(amount.toString()),
      sc.ContractParam.integer(fee.toString()),
    ];

    const networkMagic = await getNetworkMagic();
    const contract = new experimental.SmartContract(
      vaultScriptHash as unknown as import("@cityofzion/neon-core").u.HexString,
      {
        networkMagic,
        rpcAddress: RPC_URL,
        account: relayerAccount,
      },
    );

    const signers = [
      new tx.Signer({
        account: relayerAccount.scriptHash,
        scopes: tx.WitnessScope.CalledByEntry,
      }),
    ];

    const txid = await contract.invoke("withdraw", args, signers);
    keepNullifierLock = true;

    return NextResponse.json({
      success: true,
      txid,
      message: "Withdrawal submitted to network.",
      mode: RELAYER_PROOF_MODE,
    });
  } catch (error: unknown) {
    console.error("Relay Error:", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      {
        success: false,
        error: exposeErrorMessage(error, "Internal relayer error"),
      },
      { status: 500 },
    );
  } finally {
    if (lockedNullifierHex && !keepNullifierLock) {
      await safeReleaseNullifierLock(lockedNullifierHex);
    }
  }
}
