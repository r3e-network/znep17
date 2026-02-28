import { Redis } from "@upstash/redis";
import { POST as runMaintainer } from "../app/api/maintainer/route";
import { DEFAULT_VAULT_HASH } from "../app/lib/deployment-defaults";

const HASH160_HEX_RE = /^(?:0x)?[0-9a-fA-F]{40}$/;
const MAINTAINER_QUEUE_KEY_PREFIX = "znep17:maintainer-queue:";
const MAINTAINER_QUEUE_PENDING_KEY_PREFIX = "znep17:maintainer-queue-pending:";
const MAINTAINER_WORKER_EXECUTE_HEADER = "x-maintainer-worker-execute";
const DEFAULT_POLL_MS = 2_000;
const DEFAULT_MAX_BATCH_STEPS = 6;
const DEFAULT_REQUEST_URL = "https://worker.znep17.local/api/maintainer";

type MaintainerQueueJob = {
  vaultHash?: unknown;
  enqueuedAt?: unknown;
  source?: unknown;
};

type MaintainerRunResponse = {
  success?: boolean;
  message?: string;
  error?: string;
  remainingLeaves?: number;
  leavesProcessed?: number;
};

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (typeof value !== "string") return fallback;
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return fallback;
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function normalizeHash160(value: string, fieldName: string): string {
  const trimmed = value.trim();
  if (!HASH160_HEX_RE.test(trimmed)) {
    throw new Error(`${fieldName} must be a valid 20-byte script hash.`);
  }
  return trimmed.replace(/^0x/i, "").toLowerCase();
}

function resolveVaultHash(): string {
  const value =
    process.env.MAINTAINER_VAULT_HASH || process.env.VAULT_HASH || process.env.NEXT_PUBLIC_VAULT_HASH || DEFAULT_VAULT_HASH;
  return normalizeHash160(value, "MAINTAINER_VAULT_HASH/VAULT_HASH");
}

function getQueueKey(vaultHash: string): string {
  return `${MAINTAINER_QUEUE_KEY_PREFIX}${vaultHash}`;
}

function getPendingKey(vaultHash: string): string {
  return `${MAINTAINER_QUEUE_PENDING_KEY_PREFIX}${vaultHash}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readQueueJob(raw: unknown): MaintainerQueueJob | null {
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as MaintainerQueueJob;
  } catch {
    return null;
  }
}

function createWorkerHeaders(requestUrl: string): Headers {
  const headers = new Headers();
  headers.set(MAINTAINER_WORKER_EXECUTE_HEADER, "1");
  const credential = process.env.MAINTAINER_API_KEY || process.env.RELAYER_API_KEY || "";
  if (credential.trim().length > 0) {
    headers.set("x-maintainer-api-key", credential.trim());
  }

  const origin = new URL(requestUrl).origin;
  headers.set("origin", origin);
  headers.set("referer", `${origin}/worker/maintainer`);
  return headers;
}

async function runMaintainerOnce(requestUrl: string, headers: Headers): Promise<{ status: number; payload: MaintainerRunResponse | null }> {
  const request = new Request(requestUrl, {
    method: "POST",
    headers,
  });
  const response = await runMaintainer(request);

  let payload: MaintainerRunResponse | null = null;
  try {
    payload = (await response.json()) as MaintainerRunResponse;
  } catch {
    payload = null;
  }

  return {
    status: response.status,
    payload,
  };
}

async function processMaintainerBatch(
  requestUrl: string,
  maxBatchSteps: number,
  headers: Headers,
): Promise<void> {
  for (let step = 1; step <= maxBatchSteps; step++) {
    const { status, payload } = await runMaintainerOnce(requestUrl, headers);
    const message = payload?.message || payload?.error || "";

    if (status === 409) {
      console.log(`[maintainer-worker] maintainer busy (${message || "conflict"}), will wait for next job`);
      return;
    }
    if (status >= 400) {
      throw new Error(message || `Maintainer execution failed with status ${status}.`);
    }

    const remainingLeaves = typeof payload?.remainingLeaves === "number" ? payload.remainingLeaves : 0;
    const leavesProcessed = typeof payload?.leavesProcessed === "number" ? payload.leavesProcessed : undefined;
    if (typeof leavesProcessed === "number") {
      console.log(
        `[maintainer-worker] step ${step}/${maxBatchSteps}: leavesProcessed=${leavesProcessed}, remainingLeaves=${remainingLeaves}`,
      );
    } else if (message) {
      console.log(`[maintainer-worker] step ${step}/${maxBatchSteps}: ${message}`);
    } else {
      console.log(`[maintainer-worker] step ${step}/${maxBatchSteps}: maintainer run completed`);
    }

    if (remainingLeaves <= 0) {
      return;
    }
  }

  console.log(
    `[maintainer-worker] reached MAINTAINER_WORKER_MAX_BATCH_STEPS while leaves remain; next queued run will continue catch-up`,
  );
}

async function main(): Promise<void> {
  const kvRestApiUrl = process.env.KV_REST_API_URL || "";
  const kvRestApiToken = process.env.KV_REST_API_TOKEN || "";
  if (!kvRestApiUrl || !kvRestApiToken) {
    throw new Error("KV_REST_API_URL and KV_REST_API_TOKEN are required for maintainer worker queue polling.");
  }

  const vaultHash = resolveVaultHash();
  const queueKey = getQueueKey(vaultHash);
  const pendingKey = getPendingKey(vaultHash);
  const pollMs = parsePositiveInt(process.env.MAINTAINER_WORKER_POLL_MS, DEFAULT_POLL_MS);
  const maxBatchSteps = parsePositiveInt(process.env.MAINTAINER_WORKER_MAX_BATCH_STEPS, DEFAULT_MAX_BATCH_STEPS);
  const requestUrl = process.env.MAINTAINER_WORKER_REQUEST_URL || DEFAULT_REQUEST_URL;
  const headers = createWorkerHeaders(requestUrl);

  const redis = new Redis({ url: kvRestApiUrl, token: kvRestApiToken });
  console.log(
    `[maintainer-worker] started queue=${queueKey} pollMs=${pollMs} batchSteps=${maxBatchSteps} requestUrl=${requestUrl}`,
  );

  while (true) {
    try {
      const raw = await redis.lpop<unknown>(queueKey);
      if (typeof raw === "undefined" || raw === null) {
        await sleep(pollMs);
        continue;
      }

      const parsed = readQueueJob(raw);
      const source =
        parsed && typeof parsed.source === "string" && parsed.source.trim().length > 0 ? parsed.source.trim() : "unknown";
      const enqueuedAt =
        parsed && typeof parsed.enqueuedAt === "string" && parsed.enqueuedAt.trim().length > 0
          ? parsed.enqueuedAt.trim()
          : "unknown";
      console.log(`[maintainer-worker] processing queued job source=${source} enqueuedAt=${enqueuedAt}`);

      try {
        await redis.del(pendingKey);
      } catch (error: unknown) {
        console.error(
          "[maintainer-worker] failed to clear pending queue key:",
          error instanceof Error ? error.message : String(error),
        );
      }

      await processMaintainerBatch(requestUrl, maxBatchSteps, headers);
    } catch (error: unknown) {
      console.error("[maintainer-worker] loop error:", error instanceof Error ? error.message : String(error));
      await sleep(pollMs);
    }
  }
}

void main().catch((error: unknown) => {
  console.error("[maintainer-worker] fatal:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
