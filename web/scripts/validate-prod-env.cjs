#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const dotenv = require("dotenv");

const HASH160_HEX_RE = /^(?:0x)?[0-9a-fA-F]{40}$/;
const DEFAULT_RPC_URL = "https://testnet1.neo.coz.io:443";
const DEFAULT_VAULT_HASH = "0xa33b0788ad0324c5eb40ea803be8ed96f24d7fa6";
const DEFAULT_ALLOWED_TOKEN_HASHES =
  "0x2a0010799d828155cf522f47c38e4e9d797a9697,0xd2a4cff31913016155e38e474a2c06d08be276cf";
const DEFAULT_RELAYER_ALLOWED_ORIGINS = "https://znep17.app,https://www.znep17.app";
const DEFAULT_VERIFIER_HASH = "0xd3b432b5e3adae1f6e30249ee8c701eccbd1d4ab";
const DEFAULT_SUPABASE_URL = "https://dmonstzalbldzzdbbcdj.supabase.co";

function parseArgs(argv) {
  const args = { envFile: null };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--env-file") {
      const value = argv[i + 1];
      if (!value) {
        throw new Error("--env-file requires a path argument");
      }
      args.envFile = value;
      i += 1;
      continue;
    }

    if (token === "-h" || token === "--help") {
      printHelp();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  return args;
}

function printHelp() {
  console.log("validate-prod-env usage:");
  console.log("  node scripts/validate-prod-env.cjs [--env-file <path>]");
  console.log("");
  console.log("Examples:");
  console.log("  node scripts/validate-prod-env.cjs --env-file .env.local");
  console.log("  vercel env pull .env.vercel.production && node scripts/validate-prod-env.cjs --env-file .env.vercel.production");
}

function loadEnvSnapshot(envFileArg) {
  const snapshot = { ...process.env };
  if (!envFileArg) {
    return snapshot;
  }

  const resolved = path.isAbsolute(envFileArg) ? envFileArg : path.resolve(process.cwd(), envFileArg);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Env file not found: ${resolved}`);
  }

  const raw = fs.readFileSync(resolved, "utf8");
  const parsed = dotenv.parse(raw);
  for (const [key, value] of Object.entries(parsed)) {
    snapshot[key] = value;
  }

  snapshot.__VALIDATED_ENV_FILE = resolved;
  return snapshot;
}

function read(env, key) {
  const value = env[key];
  return typeof value === "string" ? value.trim() : "";
}

function parseBoolean(raw, defaultValue) {
  if (!raw) return defaultValue;
  const normalized = raw.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return defaultValue;
}

function parsePositiveInt(raw, defaultValue) {
  if (!raw) return defaultValue;
  const normalized = raw.trim();
  if (!/^\d+$/.test(normalized)) return defaultValue;
  const value = Number(normalized);
  if (!Number.isSafeInteger(value) || value <= 0) return defaultValue;
  return value;
}

function csv(env, key) {
  return read(env, key)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isSecureRpc(url) {
  return /^https:\/\//i.test(url) || /^wss:\/\//i.test(url);
}

function isHash160(value) {
  return HASH160_HEX_RE.test(value);
}

function parseTokenAllowlist(entries) {
  if (entries.length === 0) return null;
  const normalized = [];
  for (const entry of entries) {
    if (!isHash160(entry)) return null;
    normalized.push(entry.replace(/^0x/i, "").toLowerCase());
  }
  return normalized;
}

function isHttpsOriginRule(value) {
  if (/^https:\/\/\*\.[a-zA-Z0-9.-]+$/.test(value)) {
    return true;
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  return parsed.protocol === "https:";
}

function run() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnvSnapshot(args.envFile);

  const checks = [];
  const advisories = [];
  const addCheck = (name, pass, detail = "") => checks.push({ name, pass, detail });
  const addAdvisory = (name, pass, detail = "") => advisories.push({ name, pass, detail });

  const rpcUrl = read(env, "RPC_URL") || DEFAULT_RPC_URL;
  const vaultHash = read(env, "VAULT_HASH") || DEFAULT_VAULT_HASH;
  const relayerWif = read(env, "RELAYER_WIF");
  const relayerRequireOriginAllowlist = parseBoolean(read(env, "RELAYER_REQUIRE_ORIGIN_ALLOWLIST"), true);
  const relayerRequireDurableGuards = parseBoolean(read(env, "RELAYER_REQUIRE_DURABLE_GUARDS"), true);
  const relayerRequireStrongVerifier = parseBoolean(read(env, "RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER"), true);
  const relayerAllowInsecureRpc = parseBoolean(read(env, "RELAYER_ALLOW_INSECURE_RPC"), false);
  const relayerExpectedVerifierHash = read(env, "RELAYER_EXPECTED_VERIFIER_HASH") || DEFAULT_VERIFIER_HASH;
  const relayerApiKey = read(env, "RELAYER_API_KEY");
  const relayerOrigins = csv(env, "RELAYER_ALLOWED_ORIGINS");
  const mergedRelayerOrigins = relayerOrigins.length > 0 ? relayerOrigins : DEFAULT_RELAYER_ALLOWED_ORIGINS.split(",");
  const tokenAllowlist = parseTokenAllowlist(csv(env, "ALLOWED_TOKEN_HASHES").length > 0 ? csv(env, "ALLOWED_TOKEN_HASHES") : DEFAULT_ALLOWED_TOKEN_HASHES.split(","));

  const kvRestApiUrl = read(env, "KV_REST_API_URL");
  const kvRestApiToken = read(env, "KV_REST_API_TOKEN");

  const allowCustomVaultHash = parseBoolean(read(env, "NEXT_PUBLIC_ALLOW_CUSTOM_VAULT_HASH"), false);
  const enableMaintainerTools = parseBoolean(read(env, "NEXT_PUBLIC_ENABLE_MAINTAINER_TOOLS"), false);

  const maintainerVaultHash = read(env, "MAINTAINER_VAULT_HASH") || vaultHash;
  const maintainerWif = read(env, "MAINTAINER_WIF") || relayerWif;
  const maintainerRequireAuth = parseBoolean(read(env, "MAINTAINER_REQUIRE_AUTH"), true);
  const maintainerApiKey = read(env, "MAINTAINER_API_KEY") || relayerApiKey;
  const cronSecret = read(env, "CRON_SECRET");
  const maintainerRequireDurableLock = parseBoolean(read(env, "MAINTAINER_REQUIRE_DURABLE_LOCK"), true);
  const maintainerAllowInsecureRpc = parseBoolean(read(env, "MAINTAINER_ALLOW_INSECURE_RPC"), relayerAllowInsecureRpc);
  const maintainerRequireOriginAllowlist = parseBoolean(read(env, "MAINTAINER_REQUIRE_ORIGIN_ALLOWLIST"), true);
  const maintainerOrigins = csv(env, "MAINTAINER_ALLOWED_ORIGINS");
  const mergedMaintainerOrigins = maintainerOrigins.length > 0 ? maintainerOrigins : mergedRelayerOrigins;
  const maintainerRpcTimeoutMs = parsePositiveInt(read(env, "MAINTAINER_RPC_TIMEOUT_MS"), 240000);

  const supabaseUrl = read(env, "SUPABASE_URL") || read(env, "NEXT_PUBLIC_SUPABASE_URL") || DEFAULT_SUPABASE_URL;
  const supabaseServiceRoleKey = read(env, "SUPABASE_SERVICE_ROLE_KEY");

  addCheck(
    "RPC_URL is configured with secure transport",
    rpcUrl.length > 0 && (isSecureRpc(rpcUrl) || relayerAllowInsecureRpc || maintainerAllowInsecureRpc),
    rpcUrl.length === 0
      ? "missing"
      : "must start with https:// or wss:// (or set RELAYER_ALLOW_INSECURE_RPC/MAINTAINER_ALLOW_INSECURE_RPC=true)",
  );

  addCheck(
    "VAULT_HASH is a valid 20-byte script hash",
    vaultHash.length > 0 && isHash160(vaultHash),
    vaultHash.length === 0 ? "missing" : "must match 0x + 40 hex chars",
  );

  addCheck("RELAYER_WIF is configured", relayerWif.length > 0, "missing");

  addCheck(
    "ALLOWED_TOKEN_HASHES contains at least one valid script hash",
    Array.isArray(tokenAllowlist) && tokenAllowlist.length > 0,
    "missing or contains invalid hash",
  );

  addCheck(
    "RELAYER_REQUIRE_ORIGIN_ALLOWLIST=true",
    relayerRequireOriginAllowlist,
    `current=${read(env, "RELAYER_REQUIRE_ORIGIN_ALLOWLIST") || "<default:true>"}`,
  );

  addCheck(
    "RELAYER_ALLOWED_ORIGINS configured with https origins",
    mergedRelayerOrigins.length > 0 && mergedRelayerOrigins.every(isHttpsOriginRule),
    mergedRelayerOrigins.length === 0 ? "missing" : "contains non-https origin",
  );

  addCheck(
    "RELAYER_REQUIRE_DURABLE_GUARDS=true",
    relayerRequireDurableGuards,
    `current=${read(env, "RELAYER_REQUIRE_DURABLE_GUARDS") || "<default:false>"}`,
  );

  addCheck("KV_REST_API_URL is configured", kvRestApiUrl.length > 0, "missing");
  addCheck("KV_REST_API_TOKEN is configured", kvRestApiToken.length > 0, "missing");

  addCheck(
    "RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER=true",
    relayerRequireStrongVerifier,
    `current=${read(env, "RELAYER_REQUIRE_STRONG_ONCHAIN_VERIFIER") || "<default:true>"}`,
  );

  addCheck(
    "RELAYER_EXPECTED_VERIFIER_HASH is a valid 20-byte script hash",
    relayerExpectedVerifierHash.length > 0 && isHash160(relayerExpectedVerifierHash),
    relayerExpectedVerifierHash.length === 0 ? "missing" : "invalid hash format",
  );

  addCheck(
    "NEXT_PUBLIC_ALLOW_CUSTOM_VAULT_HASH is not enabled",
    !allowCustomVaultHash,
    `current=${read(env, "NEXT_PUBLIC_ALLOW_CUSTOM_VAULT_HASH") || "<default:false>"}`,
  );

  addCheck(
    "NEXT_PUBLIC_ENABLE_MAINTAINER_TOOLS is not enabled",
    !enableMaintainerTools,
    `current=${read(env, "NEXT_PUBLIC_ENABLE_MAINTAINER_TOOLS") || "<default:false>"}`,
  );

  addCheck(
    "MAINTAINER_VAULT_HASH (or VAULT_HASH) is a valid script hash",
    maintainerVaultHash.length > 0 && isHash160(maintainerVaultHash),
    maintainerVaultHash.length === 0 ? "missing" : "must match 0x + 40 hex chars",
  );

  addCheck(
    "Maintainer signer is configured via RELAYER_WIF (MAINTAINER_WIF optional override)",
    maintainerWif.length > 0,
    "missing",
  );

  addCheck(
    "MAINTAINER_REQUIRE_AUTH=true",
    maintainerRequireAuth,
    `current=${read(env, "MAINTAINER_REQUIRE_AUTH") || "<default:true>"}`,
  );

  addCheck(
    "Maintainer auth secret is configured via RELAYER_API_KEY (MAINTAINER_API_KEY optional override)",
    maintainerApiKey.length > 0,
    "missing",
  );

  addCheck(
    "MAINTAINER_REQUIRE_DURABLE_LOCK=true",
    maintainerRequireDurableLock,
    `current=${read(env, "MAINTAINER_REQUIRE_DURABLE_LOCK") || "<default:true>"}`,
  );

  addCheck(
    "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) is configured with https",
    supabaseUrl.length > 0 && /^https:\/\//i.test(supabaseUrl),
    supabaseUrl.length === 0 ? "missing" : "must start with https://",
  );

  addCheck("SUPABASE_SERVICE_ROLE_KEY is configured", supabaseServiceRoleKey.length > 0, "missing");

  addAdvisory(
    "MAINTAINER_REQUIRE_ORIGIN_ALLOWLIST=true is recommended",
    maintainerRequireOriginAllowlist,
    `current=${read(env, "MAINTAINER_REQUIRE_ORIGIN_ALLOWLIST") || "<default:false>"}`,
  );

  if (maintainerRequireOriginAllowlist) {
    addAdvisory(
      "MAINTAINER_ALLOWED_ORIGINS (or RELAYER_ALLOWED_ORIGINS) uses https origins",
      mergedMaintainerOrigins.length > 0 && mergedMaintainerOrigins.every(isHttpsOriginRule),
      mergedMaintainerOrigins.length === 0 ? "missing" : "contains non-https origin",
    );
  }

  addAdvisory(
    "CRON_SECRET matches maintainer auth secret for Vercel Cron",
    cronSecret.length > 0 && maintainerApiKey.length > 0 && cronSecret === maintainerApiKey,
    cronSecret.length === 0
      ? "missing (recommended for automated /api/maintainer cron calls)"
      : maintainerApiKey.length === 0
        ? "maintainer auth secret missing"
        : "CRON_SECRET should equal maintainer auth secret",
  );

  addAdvisory(
    "MAINTAINER_RPC_TIMEOUT_MS is high enough for proving load (recommended >= 120000)",
    maintainerRpcTimeoutMs >= 120000,
    `current=${maintainerRpcTimeoutMs}`,
  );

  const passed = checks.filter((check) => check.pass).length;
  const failedChecks = checks.filter((check) => !check.pass);
  const warningCount = advisories.filter((item) => !item.pass).length;

  const source = env.__VALIDATED_ENV_FILE ? `env file ${env.__VALIDATED_ENV_FILE}` : "process.env";
  console.log(`Production checklist source: ${source}`);
  console.log(`Required checks: ${passed}/${checks.length} passed`);

  for (const check of checks) {
    const status = check.pass ? "PASS" : "FAIL";
    const detail = !check.pass && check.detail ? ` (${check.detail})` : "";
    console.log(`${status} - ${check.name}${detail}`);
  }

  if (advisories.length > 0) {
    console.log("Advisories:");
    for (const advisory of advisories) {
      const status = advisory.pass ? "PASS" : "WARN";
      const detail = !advisory.pass && advisory.detail ? ` (${advisory.detail})` : "";
      console.log(`${status} - ${advisory.name}${detail}`);
    }
  }

  if (failedChecks.length > 0) {
    console.error(`Validation failed: ${failedChecks.length} required check(s) did not pass.`);
    process.exit(1);
  }

  if (warningCount > 0) {
    console.warn(`Validation passed with ${warningCount} advisory warning(s).`);
    process.exit(0);
  }

  console.log("Validation passed: production env is ready.");
}

try {
  run();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`validate-prod-env failed: ${message}`);
  process.exit(1);
}
