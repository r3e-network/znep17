import { NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import path from "node:path";
import { existsSync } from "node:fs";
import { experimental, rpc, sc, tx, wallet } from "@cityofzion/neon-js";
import { Redis } from "@upstash/redis";
import { poseidon2Bls } from "../../lib/blsPoseidon";
import { getSupabaseAdminClient } from "../../lib/supabase";
import { isOriginAllowed, parseBearerToken, parseOriginAllowlist } from "../relay/policy";
import { encodeBigIntToLeScalar, encodeGroth16ProofPayload } from "../relay/zk-encoding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HASH160_HEX_RE = /^(?:0x)?[0-9a-fA-F]{40}$/;
const HEX32_RE = /^[0-9a-fA-F]{64}$/;
const TREE_DEPTH = 20;
const DEFAULT_LOCK_TTL_MS = 120_000;
const DEFAULT_MAX_SYNC_LEAVES = 20_000;
const DEFAULT_CHAIN_FETCH_CONCURRENCY = 6;
const TREE_UPDATE_PUBLIC_INPUT_COUNT = 5;
const TREE_UPDATE_PUBLIC_INPUTS_PACKED_BYTES = 160;

type GuardStoreMode = "memory" | "durable";

type MaintainerConfig = {
  rpcUrl: string;
  vaultHash: string;
  maintainerWif: string;
  maintainerApiKey: string;
  treeUpdateWasmPath: string;
  treeUpdateZkeyPath: string;
  requireAuth: boolean;
  requireOriginAllowlist: boolean;
  requireDurableLock: boolean;
  originAllowlist: ReturnType<typeof parseOriginAllowlist>;
  isProduction: boolean;
  guardStoreMode: GuardStoreMode;
  lockTtlMs: number;
  maxSyncLeaves: number;
  chainFetchConcurrency: number;
  kvRestApiUrl: string;
  kvRestApiToken: string;
  allowInsecureRpc: boolean;
};

type RpcStackItem = {
  type?: string;
  value?: unknown;
};

type RpcInvokeResult = {
  state?: string;
  exception?: string | null;
  stack?: RpcStackItem[];
};

type RpcClientInstance = InstanceType<typeof rpc.RPCClient>;

type TreeUpdateSnarkjs = {
  groth16: {
    fullProve: (
      witness: Record<string, unknown>,
      wasmPath: string,
      zkeyPath: string,
    ) => Promise<{ proof: unknown; publicSignals: unknown[] }>;
  };
};

type TreeUpdateWitnessData = {
  oldRoot: bigint;
  newRoot: bigint;
  oldLeaf: bigint;
  newLeaf: bigint;
  leafIndex: number;
  pathElements: bigint[];
};

const ZERO_HASHES = buildZeroHashes();
const inMemoryLocks = new Map<string, number>();
let snarkjsPromise: Promise<TreeUpdateSnarkjs> | null = null;

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
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return defaultValue;
  return parsed;
}

function hasSecureRpcTransport(url: string): boolean {
  const value = url.trim();
  return /^https:\/\//i.test(value) || /^wss:\/\//i.test(value);
}

function normalizeHash160(input: string, fieldName: string): string {
  const trimmed = input.trim();
  if (!HASH160_HEX_RE.test(trimmed)) {
    throw new Error(`${fieldName} must be a valid 20-byte script hash.`);
  }
  return trimmed.replace(/^0x/i, "").toLowerCase();
}

function hasInsecureOriginRule(allowlist: NonNullable<ReturnType<typeof parseOriginAllowlist>>): boolean {
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

function readMaintainerCredential(headers: Headers): string | null {
  const headerKey = headers.get("x-maintainer-api-key");
  if (headerKey && headerKey.trim().length > 0) {
    return headerKey.trim();
  }
  const relayerHeaderKey = headers.get("x-relayer-api-key");
  if (relayerHeaderKey && relayerHeaderKey.trim().length > 0) {
    return relayerHeaderKey.trim();
  }
  return parseBearerToken(headers.get("authorization"));
}

function isVercelCronInvocation(headers: Headers): boolean {
  const marker = headers.get("x-vercel-cron");
  return typeof marker === "string" && marker.trim().length > 0;
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = createHash("sha256").update(left, "utf8").digest();
  const rightBuffer = createHash("sha256").update(right, "utf8").digest();
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function exposeError(error: unknown, isProduction: boolean): string {
  if (isProduction) {
    return "Maintainer request failed.";
  }
  return error instanceof Error ? error.message : String(error);
}

function buildZeroHashes(): bigint[] {
  const hashes = [0n];
  for (let level = 0; level < TREE_DEPTH; level++) {
    hashes.push(poseidon2Bls([hashes[level], hashes[level]]));
  }
  return hashes;
}

function computeMerkleRoot(leaves: bigint[]): bigint {
  if (leaves.length > (1 << TREE_DEPTH)) {
    throw new Error("Leaf count exceeds Merkle tree capacity.");
  }

  let currentLevel = leaves.slice();
  for (let level = 0; level < TREE_DEPTH; level++) {
    if (currentLevel.length === 0) {
      return ZERO_HASHES[TREE_DEPTH];
    }

    const nextLevel: bigint[] = [];
    const zero = ZERO_HASHES[level];
    for (let i = 0; i < currentLevel.length; i += 2) {
      const left = currentLevel[i];
      if (typeof left !== "bigint") {
        throw new Error("Merkle tree leaf is missing.");
      }
      const right = i + 1 < currentLevel.length ? currentLevel[i + 1] : zero;
      nextLevel.push(poseidon2Bls([left, right]));
    }
    currentLevel = nextLevel;
  }

  const root = currentLevel[0];
  if (typeof root !== "bigint") {
    throw new Error("Merkle root derivation failed.");
  }
  return root;
}

function toRootHex(root: bigint): string {
  let rootHex = root.toString(16);
  while (rootHex.length < 64) rootHex = `0${rootHex}`;
  return rootHex;
}

async function loadSnarkjs(): Promise<TreeUpdateSnarkjs> {
  if (!snarkjsPromise) {
    snarkjsPromise = import("snarkjs") as unknown as Promise<TreeUpdateSnarkjs>;
  }
  return snarkjsPromise;
}

function buildMerkleLayers(leaves: bigint[]): bigint[][] {
  const layers: bigint[][] = [leaves.slice()];
  let current = layers[0];

  for (let level = 0; level < TREE_DEPTH; level++) {
    const nextLength = Math.max(1, Math.ceil(current.length / 2));
    const next = new Array<bigint>(nextLength);
    for (let i = 0; i < nextLength; i++) {
      const left = current[i * 2] ?? ZERO_HASHES[level];
      const right = current[i * 2 + 1] ?? ZERO_HASHES[level];
      next[i] = poseidon2Bls([left, right]);
    }
    layers.push(next);
    current = next;
  }

  return layers;
}

function buildTreeUpdateWitness(existingLeaves: bigint[], newLeaf: bigint): TreeUpdateWitnessData {
  const leafIndex = existingLeaves.length;
  const oldLeaf = 0n;
  const layers = buildMerkleLayers(existingLeaves);
  const oldRoot = layers[TREE_DEPTH]?.[0] ?? ZERO_HASHES[TREE_DEPTH];

  const pathElements: bigint[] = [];
  let idx = leafIndex;
  for (let level = 0; level < TREE_DEPTH; level++) {
    const siblingIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    pathElements.push(layers[level]?.[siblingIdx] ?? ZERO_HASHES[level]);
    idx = Math.floor(idx / 2);
  }

  const newRoot = computeMerkleRoot(existingLeaves.concat([newLeaf]));
  return { oldRoot, newRoot, oldLeaf, newLeaf, leafIndex, pathElements };
}

function coerceSignalToBigInt(value: unknown, label: string): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "string") return BigInt(value);
  if (typeof value === "number" && Number.isSafeInteger(value)) return BigInt(value);
  throw new Error(`${label} must be an integer-encoded field element.`);
}

function encodeTreeUpdatePublicInputs(publicSignals: unknown[]): string {
  if (!Array.isArray(publicSignals) || publicSignals.length !== TREE_UPDATE_PUBLIC_INPUT_COUNT) {
    throw new Error(`Tree update proof must expose ${TREE_UPDATE_PUBLIC_INPUT_COUNT} public signals.`);
  }

  const encoded: Buffer[] = [];
  for (let i = 0; i < publicSignals.length; i++) {
    encoded.push(
      encodeBigIntToLeScalar(
        coerceSignalToBigInt(publicSignals[i], `treeUpdate.publicSignals[${i}]`),
        `treeUpdate.publicSignals[${i}]`,
      ),
    );
  }

  const payload = Buffer.concat(encoded);
  if (payload.length !== TREE_UPDATE_PUBLIC_INPUTS_PACKED_BYTES) {
    throw new Error("Tree update public input payload length mismatch.");
  }
  return payload.toString("base64");
}

async function buildTreeUpdateProofPayload(
  config: MaintainerConfig,
  existingLeaves: bigint[],
  newLeaf: bigint,
): Promise<{
  oldRootHex: string;
  newRootHex: string;
  proofPayload: string;
  publicInputsPayload: string;
  updatedLeafCount: number;
}> {
  const witness = buildTreeUpdateWitness(existingLeaves, newLeaf);

  const witnessInput = {
    oldRoot: witness.oldRoot.toString(),
    newRoot: witness.newRoot.toString(),
    oldLeaf: witness.oldLeaf.toString(),
    newLeaf: witness.newLeaf.toString(),
    leafIndex: witness.leafIndex.toString(),
    pathElements: witness.pathElements.map((entry) => entry.toString()),
  };

  const expectedPublicSignals = [
    witness.oldRoot,
    witness.newRoot,
    witness.oldLeaf,
    witness.newLeaf,
    BigInt(witness.leafIndex),
  ];

  const snarkjs = await loadSnarkjs();
  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    witnessInput,
    config.treeUpdateWasmPath,
    config.treeUpdateZkeyPath,
  );
  if (!Array.isArray(publicSignals) || publicSignals.length !== TREE_UPDATE_PUBLIC_INPUT_COUNT) {
    throw new Error("Tree update proving returned invalid public signals.");
  }
  for (let i = 0; i < expectedPublicSignals.length; i++) {
    const actual = coerceSignalToBigInt(publicSignals[i], `treeUpdate.publicSignals[${i}]`);
    if (actual !== expectedPublicSignals[i]) {
      throw new Error(`Tree update public signal mismatch at index ${i}.`);
    }
  }

  const proofPayload = await encodeGroth16ProofPayload(proof);
  const publicInputsPayload = encodeTreeUpdatePublicInputs(publicSignals);

  return {
    oldRootHex: toRootHex(witness.oldRoot),
    newRootHex: toRootHex(witness.newRoot),
    proofPayload,
    publicInputsPayload,
    updatedLeafCount: witness.leafIndex + 1,
  };
}

function parseRpcInteger(item: RpcStackItem, fieldName: string): number {
  const raw = item.value;
  let parsed: bigint;
  if (typeof raw === "string") {
    if (!/^-?\d+$/.test(raw)) {
      throw new Error(`${fieldName} is not a valid integer.`);
    }
    parsed = BigInt(raw);
  } else if (typeof raw === "number") {
    if (!Number.isSafeInteger(raw)) {
      throw new Error(`${fieldName} is not a safe integer.`);
    }
    parsed = BigInt(raw);
  } else if (typeof raw === "bigint") {
    parsed = raw;
  } else {
    throw new Error(`${fieldName} integer value is missing.`);
  }

  if (parsed < 0n) {
    throw new Error(`${fieldName} cannot be negative.`);
  }
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error(`${fieldName} exceeds supported range.`);
  }
  return Number(parsed);
}

function parseRpcByteArrayHex(item: RpcStackItem, fieldName: string, expectedBytes: number): string {
  if (item.type !== "ByteString" && item.type !== "ByteArray" && item.type !== "Buffer") {
    throw new Error(`${fieldName} must be a byte string.`);
  }
  if (typeof item.value !== "string") {
    throw new Error(`${fieldName} byte payload is missing.`);
  }
  const hex = Buffer.from(item.value, "base64").toString("hex").toLowerCase();
  if (!/^[0-9a-f]*$/.test(hex) || hex.length !== expectedBytes * 2) {
    throw new Error(`${fieldName} must be ${expectedBytes} bytes.`);
  }
  return hex;
}

function assertInvokeSuccess(result: RpcInvokeResult, operation: string): RpcStackItem[] {
  if (result.exception) {
    throw new Error(`${operation} failed: ${result.exception}`);
  }
  if (typeof result.state === "string" && !result.state.startsWith("HALT")) {
    throw new Error(`${operation} did not halt cleanly: ${result.state}`);
  }
  if (!Array.isArray(result.stack) || result.stack.length === 0) {
    throw new Error(`${operation} returned an empty stack.`);
  }
  return result.stack as RpcStackItem[];
}

async function callContractInteger(
  client: RpcClientInstance,
  vaultHash: string,
  operation: string,
  args: unknown[] = [],
): Promise<number> {
  const response = await client.invokeFunction(vaultHash, operation, args);
  const stack = assertInvokeSuccess(response, operation);
  return parseRpcInteger(stack[0], operation);
}

async function callContractLeafHex(client: RpcClientInstance, vaultHash: string, index: number): Promise<string> {
  const response = await client.invokeFunction(vaultHash, "getLeaf", [sc.ContractParam.integer(index)]);
  const stack = assertInvokeSuccess(response, `getLeaf(${index})`);
  return parseRpcByteArrayHex(stack[0], `leaf ${index}`, 32);
}

async function callContractRootHex(client: RpcClientInstance, vaultHash: string): Promise<string | null> {
  const response = await client.invokeFunction(vaultHash, "getCurrentRoot", []);
  const stack = assertInvokeSuccess(response, "getCurrentRoot");
  const item = stack[0];
  if (item.type !== "ByteString" && item.type !== "ByteArray" && item.type !== "Buffer") {
    throw new Error("current root must be a byte string.");
  }
  if (typeof item.value !== "string") {
    throw new Error("current root byte payload is missing.");
  }
  const hex = Buffer.from(item.value, "base64").toString("hex").toLowerCase();
  if (hex.length === 0) {
    return null;
  }
  if (!HEX32_RE.test(hex)) {
    throw new Error("current root must be 32 bytes.");
  }
  return hex;
}

function normalizeLeafHash(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (!HEX32_RE.test(normalized)) return null;
  return normalized;
}

async function loadLeafCache(leafCount: number): Promise<Map<number, string>> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("deposits")
    .select("leaf_index, leaf_hash")
    .lt("leaf_index", leafCount)
    .order("leaf_index", { ascending: true });

  if (error) {
    throw new Error(`Failed to read Supabase leaves: ${error.message}`);
  }

  const leaves = new Map<number, string>();
  for (const row of data || []) {
    const entry = row as Record<string, unknown>;
    const rawIndex = entry["leaf_index"];
    const index = typeof rawIndex === "number" ? rawIndex : Number(rawIndex);
    if (!Number.isSafeInteger(index) || index < 0 || index >= leafCount) {
      continue;
    }
    const hash = normalizeLeafHash(entry["leaf_hash"]);
    if (!hash) {
      continue;
    }
    const existing = leaves.get(index);
    if (existing && existing !== hash) {
      throw new Error(`Conflicting cached leaf hash at index ${index}.`);
    }
    leaves.set(index, hash);
  }

  return leaves;
}

async function persistLeaves(rows: Array<{ leaf_index: number; leaf_hash: string }>): Promise<void> {
  if (rows.length === 0) {
    return;
  }

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("deposits").upsert(rows, { onConflict: "leaf_index" });
  if (error) {
    throw new Error(`Failed to persist Supabase leaves: ${error.message}`);
  }
}

function buildMissingIndices(cache: Map<number, string>, leafCount: number): number[] {
  const missing: number[] = [];
  for (let index = 0; index < leafCount; index++) {
    if (!cache.has(index)) {
      missing.push(index);
    }
  }
  return missing;
}

async function fetchLeavesForIndices(
  client: RpcClientInstance,
  vaultHash: string,
  indices: number[],
  concurrency: number,
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (indices.length === 0) {
    return result;
  }

  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, indices.length));

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = indices[cursor];
      cursor += 1;
      if (typeof index !== "number") {
        break;
      }

      const leafHash = await callContractLeafHex(client, vaultHash, index);
      result.set(index, leafHash);
    }
  });

  await Promise.all(workers);
  return result;
}

function assembleLeaves(cache: Map<number, string>, leafCount: number): bigint[] {
  const leaves: bigint[] = new Array<bigint>(leafCount);
  for (let index = 0; index < leafCount; index++) {
    const hash = cache.get(index);
    if (!hash) {
      throw new Error(`Leaf cache is incomplete at index ${index}.`);
    }
    leaves[index] = BigInt(`0x${hash}`);
  }
  return leaves;
}

function cleanupMemoryLocks(now: number): void {
  for (const [key, expiresAt] of inMemoryLocks.entries()) {
    if (expiresAt <= now) {
      inMemoryLocks.delete(key);
    }
  }
}

function acquireMemoryLock(key: string, ttlMs: number): boolean {
  const now = Date.now();
  cleanupMemoryLocks(now);

  const existing = inMemoryLocks.get(key);
  if (typeof existing === "number" && existing > now) {
    return false;
  }

  inMemoryLocks.set(key, now + ttlMs);
  return true;
}

function releaseMemoryLock(key: string): void {
  inMemoryLocks.delete(key);
}

function createRedisClient(config: MaintainerConfig): Redis | null {
  if (!config.kvRestApiUrl || !config.kvRestApiToken) {
    return null;
  }
  return new Redis({ url: config.kvRestApiUrl, token: config.kvRestApiToken });
}

async function acquireDurableLock(redisClient: Redis | null, key: string, ttlMs: number): Promise<boolean> {
  if (!redisClient) {
    throw new Error("Durable lock is not configured.");
  }
  const result = await redisClient.set(key, "1", { nx: true, px: ttlMs });
  return result === "OK";
}

async function releaseDurableLock(redisClient: Redis | null, key: string): Promise<void> {
  if (!redisClient) return;
  await redisClient.del(key);
}

async function acquireRunLock(config: MaintainerConfig, lockKey: string, redisClient: Redis | null): Promise<boolean> {
  if (config.guardStoreMode === "durable") {
    return acquireDurableLock(redisClient, lockKey, config.lockTtlMs);
  }
  return acquireMemoryLock(lockKey, config.lockTtlMs);
}

async function releaseRunLock(config: MaintainerConfig, lockKey: string, redisClient: Redis | null): Promise<void> {
  if (config.guardStoreMode === "durable") {
    await releaseDurableLock(redisClient, lockKey);
    return;
  }
  releaseMemoryLock(lockKey);
}

function parseConfig(): MaintainerConfig {
  const nodeEnv = (process.env.NODE_ENV || "").trim().toLowerCase();
  const vercelEnv = (process.env.VERCEL_ENV || "").trim().toLowerCase();
  const isProduction = vercelEnv === "production" || (nodeEnv === "production" && vercelEnv.length === 0);

  const rpcUrl =
    process.env.MAINTAINER_RPC_URL ||
    process.env.RPC_URL ||
    process.env.NEXT_PUBLIC_RPC_URL ||
    "https://testnet1.neo.coz.io:443";
  const rawVaultHash =
    process.env.MAINTAINER_VAULT_HASH ||
    process.env.VAULT_HASH ||
    process.env.NEXT_PUBLIC_VAULT_HASH ||
    "";
  const maintainerWif = process.env.MAINTAINER_WIF || process.env.RELAYER_WIF || "";
  const maintainerApiKey = process.env.MAINTAINER_API_KEY || process.env.RELAYER_API_KEY || "";
  const treeUpdateWasmPath =
    process.env.MAINTAINER_TREE_UPDATE_WASM_PATH || path.join(process.cwd(), "public", "zk", "tree_update.wasm");
  const treeUpdateZkeyPath =
    process.env.MAINTAINER_TREE_UPDATE_ZKEY_PATH || path.join(process.cwd(), "public", "zk", "tree_update_final.zkey");
  const requireAuth = parseBooleanEnv(process.env.MAINTAINER_REQUIRE_AUTH, isProduction);
  const requireOriginAllowlist = parseBooleanEnv(process.env.MAINTAINER_REQUIRE_ORIGIN_ALLOWLIST, false);
  const requireDurableLock = parseBooleanEnv(process.env.MAINTAINER_REQUIRE_DURABLE_LOCK, isProduction);
  const allowInsecureRpc = parseBooleanEnv(
    process.env.MAINTAINER_ALLOW_INSECURE_RPC,
    parseBooleanEnv(process.env.RELAYER_ALLOW_INSECURE_RPC, false),
  );
  const allowedOriginsRaw = process.env.MAINTAINER_ALLOWED_ORIGINS || process.env.RELAYER_ALLOWED_ORIGINS || "";
  const originAllowlist = parseOriginAllowlist(allowedOriginsRaw);
  const maxSyncLeaves = parsePositiveIntEnv(process.env.MAINTAINER_MAX_SYNC_LEAVES, DEFAULT_MAX_SYNC_LEAVES);
  const chainFetchConcurrency = parsePositiveIntEnv(
    process.env.MAINTAINER_CHAIN_FETCH_CONCURRENCY,
    DEFAULT_CHAIN_FETCH_CONCURRENCY,
  );
  const lockTtlMs = parsePositiveIntEnv(process.env.MAINTAINER_LOCK_TTL_MS, DEFAULT_LOCK_TTL_MS);
  const kvRestApiUrl = process.env.KV_REST_API_URL || "";
  const kvRestApiToken = process.env.KV_REST_API_TOKEN || "";
  const guardStoreMode: GuardStoreMode =
    kvRestApiUrl.trim().length > 0 && kvRestApiToken.trim().length > 0 ? "durable" : "memory";

  const vaultHash = rawVaultHash.trim();

  return {
    rpcUrl,
    vaultHash,
    maintainerWif,
    maintainerApiKey,
    treeUpdateWasmPath,
    treeUpdateZkeyPath,
    requireAuth,
    requireOriginAllowlist,
    requireDurableLock,
    originAllowlist,
    isProduction,
    guardStoreMode,
    lockTtlMs,
    maxSyncLeaves,
    chainFetchConcurrency,
    kvRestApiUrl,
    kvRestApiToken,
    allowInsecureRpc,
  };
}

function validateConfig(config: MaintainerConfig): string[] {
  const issues: string[] = [];

  if (!config.allowInsecureRpc && !hasSecureRpcTransport(config.rpcUrl)) {
    issues.push("MAINTAINER_RPC_URL/RPC_URL must use https:// or wss://.");
  }

  if (!config.vaultHash) {
    issues.push("MAINTAINER_VAULT_HASH/VAULT_HASH is required.");
  } else {
    try {
      config.vaultHash = normalizeHash160(config.vaultHash, "MAINTAINER_VAULT_HASH/VAULT_HASH");
    } catch {
      issues.push("MAINTAINER_VAULT_HASH/VAULT_HASH must be a valid 20-byte script hash.");
    }
  }

  if (!config.maintainerWif) {
    issues.push("RELAYER_WIF is required (MAINTAINER_WIF is optional override).");
  } else {
    try {
      void new wallet.Account(config.maintainerWif);
    } catch {
      issues.push("MAINTAINER_WIF is invalid.");
    }
  }

  if (!existsSync(config.treeUpdateWasmPath)) {
    issues.push(`Tree update wasm artifact is missing at ${config.treeUpdateWasmPath}.`);
  }
  if (!existsSync(config.treeUpdateZkeyPath)) {
    issues.push(`Tree update zkey artifact is missing at ${config.treeUpdateZkeyPath}.`);
  }

  if (config.requireAuth && !config.maintainerApiKey) {
    issues.push(
      "RELAYER_API_KEY is required when MAINTAINER_REQUIRE_AUTH=true (MAINTAINER_API_KEY is optional override).",
    );
  }

  if (config.requireOriginAllowlist && !config.originAllowlist) {
    issues.push("MAINTAINER_ALLOWED_ORIGINS is required when MAINTAINER_REQUIRE_ORIGIN_ALLOWLIST=true.");
  }

  if (config.requireDurableLock && config.guardStoreMode !== "durable") {
    issues.push("Durable lock storage is required. Configure KV_REST_API_URL and KV_REST_API_TOKEN.");
  }

  if (config.isProduction && !config.requireAuth) {
    issues.push("MAINTAINER_REQUIRE_AUTH must be true in production.");
  }

  if (config.isProduction && !config.requireDurableLock) {
    issues.push("MAINTAINER_REQUIRE_DURABLE_LOCK must be true in production.");
  }

  if (config.isProduction && config.originAllowlist && hasInsecureOriginRule(config.originAllowlist)) {
    issues.push("MAINTAINER_ALLOWED_ORIGINS must only contain https origins in production.");
  }

  return issues;
}

async function appendRootMetadata(leafCount: number, rootHash: string, txHash: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("merkle_roots").insert({
    leaf_count: leafCount,
    root_hash: rootHash,
    tx_hash: txHash,
  });
  if (error) {
    return error.message;
  }
  return null;
}

export async function POST(req: Request) {
  let config: MaintainerConfig | null = null;
  let redisClient: Redis | null = null;
  let lockKey: string | null = null;
  let lockHeld = false;

  try {
    config = parseConfig();
    const issues = validateConfig(config);
    if (issues.length > 0) {
      return NextResponse.json(
        { error: "Maintainer is not fully configured.", issues },
        { status: 503 },
      );
    }

    const credential = readMaintainerCredential(req.headers);
    if (config.requireAuth) {
      if (!credential || !constantTimeEquals(credential, config.maintainerApiKey)) {
        return NextResponse.json({ error: "Missing or invalid maintainer API key." }, { status: 401 });
      }
    }
    if (config.requireOriginAllowlist && !isOriginAllowed(req.headers, config.originAllowlist)) {
      const isTrustedCron =
        isVercelCronInvocation(req.headers) &&
        config.requireAuth &&
        Boolean(credential) &&
        constantTimeEquals(credential as string, config.maintainerApiKey);
      if (!isTrustedCron) {
        return NextResponse.json({ error: "Origin not allowed." }, { status: 403 });
      }
    }

    // Validate Supabase configuration before touching chain state.
    void getSupabaseAdminClient();

    redisClient = createRedisClient(config);
    lockKey = `znep17:maintainer-lock:${config.vaultHash}`;
    lockHeld = await acquireRunLock(config, lockKey, redisClient);
    if (!lockHeld) {
      return NextResponse.json(
        { error: "Maintainer update already in progress. Retry shortly." },
        { status: 409 },
      );
    }

    const account = new wallet.Account(config.maintainerWif);
    const rpcClient = new rpc.RPCClient(config.rpcUrl);
    const vaultHashPrefixed = `0x${config.vaultHash}`;

    const leafCount = await callContractInteger(rpcClient, vaultHashPrefixed, "getLeafIndex");
    const lastRootLeafCount = await callContractInteger(rpcClient, vaultHashPrefixed, "getLastRootLeafCount");
    const currentRootHex = await callContractRootHex(rpcClient, vaultHashPrefixed);

    if (lastRootLeafCount > leafCount) {
      throw new Error("Invalid chain state: last rooted leaf count exceeds total leaf count.");
    }
    if (leafCount === lastRootLeafCount) {
      return NextResponse.json({
        success: true,
        message: "Tree is already up to date.",
        currentLeaves: leafCount,
      });
    }

    const requiredLeafCount = lastRootLeafCount + 1;
    const leafCache = await loadLeafCache(requiredLeafCount);
    let missingIndices = buildMissingIndices(leafCache, requiredLeafCount);
    if (missingIndices.length > config.maxSyncLeaves) {
      return NextResponse.json(
        {
          error: `Supabase cache is missing ${missingIndices.length} leaves required for the next root update step, exceeding MAINTAINER_MAX_SYNC_LEAVES=${config.maxSyncLeaves}.`,
        },
        { status: 503 },
      );
    }

    if (missingIndices.length > 0) {
      const fetched = await fetchLeavesForIndices(
        rpcClient,
        vaultHashPrefixed,
        missingIndices,
        config.chainFetchConcurrency,
      );
      const toPersist: Array<{ leaf_index: number; leaf_hash: string }> = [];
      for (const index of missingIndices) {
        const leafHash = fetched.get(index);
        if (!leafHash) {
          throw new Error(`Failed to fetch missing leaf ${index}.`);
        }
        leafCache.set(index, leafHash);
        toPersist.push({ leaf_index: index, leaf_hash: leafHash });
      }
      await persistLeaves(toPersist);
      missingIndices = buildMissingIndices(leafCache, requiredLeafCount);
      if (missingIndices.length > 0) {
        throw new Error("Leaf cache is still incomplete after sync.");
      }
    }

    const leaves = assembleLeaves(leafCache, requiredLeafCount);
    const rootedLeaves = leaves.slice(0, lastRootLeafCount);
    const nextLeaf = leaves[lastRootLeafCount];
    if (typeof nextLeaf !== "bigint") {
      throw new Error(`Missing next leaf at index ${lastRootLeafCount}.`);
    }

    const treeUpdateProof = await buildTreeUpdateProofPayload(config, rootedLeaves, nextLeaf);
    if (currentRootHex && currentRootHex !== treeUpdateProof.oldRootHex) {
      throw new Error(
        "Cached leaves do not match current on-chain root. Rebuild the cache before publishing a new root.",
      );
    }
    if (lastRootLeafCount > 0 && !currentRootHex) {
      throw new Error("Current root is missing while lastRootLeafCount is non-zero.");
    }

    const latestLeafCount = await callContractInteger(rpcClient, vaultHashPrefixed, "getLeafIndex");
    const latestLastRootLeafCount = await callContractInteger(rpcClient, vaultHashPrefixed, "getLastRootLeafCount");
    if (latestLastRootLeafCount !== lastRootLeafCount || latestLeafCount < requiredLeafCount) {
      return NextResponse.json(
        {
          error: "Root state changed while computing proof. Retry update to avoid publishing stale data.",
          previousLeafCount: leafCount,
          currentLeafCount: latestLeafCount,
          previousLastRootLeafCount: lastRootLeafCount,
          currentLastRootLeafCount: latestLastRootLeafCount,
        },
        { status: 409 },
      );
    }

    const versionRes = await rpcClient.getVersion();
    const networkMagic = versionRes.protocol.network;
    const contract = new experimental.SmartContract(
      vaultHashPrefixed as unknown as import("@cityofzion/neon-core").u.HexString,
      {
        networkMagic,
        rpcAddress: config.rpcUrl,
        account,
      },
    );

    const signers = [
      new tx.Signer({
        account: account.scriptHash,
        scopes: tx.WitnessScope.CalledByEntry,
      }),
    ];

    const newRootPayload = Buffer.from(treeUpdateProof.newRootHex, "hex").toString("base64");
    const txid = await contract.invoke(
      "updateMerkleRoot",
      [
        sc.ContractParam.byteArray(treeUpdateProof.proofPayload),
        sc.ContractParam.byteArray(treeUpdateProof.publicInputsPayload),
        sc.ContractParam.byteArray(newRootPayload),
      ],
      signers,
    );

    const metadataWarning = await appendRootMetadata(treeUpdateProof.updatedLeafCount, treeUpdateProof.newRootHex, txid);
    const remainingLeaves = Math.max(0, latestLeafCount - treeUpdateProof.updatedLeafCount);

    return NextResponse.json({
      success: true,
      message: "Merkle root updated successfully.",
      txid,
      newRoot: treeUpdateProof.newRootHex,
      leavesProcessed: treeUpdateProof.updatedLeafCount,
      remainingLeaves,
      ...(metadataWarning ? { warning: `Root published but metadata insert failed: ${metadataWarning}` } : {}),
    });
  } catch (error: unknown) {
    const isProduction = config?.isProduction ?? false;
    console.error("Maintainer Error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      {
        success: false,
        error: exposeError(error, isProduction),
      },
      { status: 500 },
    );
  } finally {
    if (config && lockKey && lockHeld) {
      try {
        await releaseRunLock(config, lockKey, redisClient);
      } catch (releaseError: unknown) {
        console.error(
          "Failed to release maintainer lock:",
          releaseError instanceof Error ? releaseError.message : String(releaseError),
        );
      }
    }
  }
}
