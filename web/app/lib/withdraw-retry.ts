export const MERKLE_FINALIZATION_RETRY_DELAY_MS = 12_000;
export const PROOF_RATE_LIMIT_RETRY_DELAY_MS = 65_000;
export const MERKLE_FINALIZATION_MAX_WAIT_MS = 10 * 60_000;

type RetryDecision = {
  retry: boolean;
  delayMs?: number;
  errorMessage?: string;
};

const FINALIZATION_DELAY_MESSAGE = "not yet included in a finalized merkle root";
const PROOF_RATE_LIMIT_MESSAGE = "too many proof requests";

function formatElapsed(ms: number): string {
  const safe = Math.max(0, ms);
  const seconds = Math.floor(safe / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

export function getMerkleProofRetryDecision(rawReason: string, elapsedMs: number): RetryDecision {
  const normalizedReason = rawReason.trim().toLowerCase();

  if (normalizedReason.includes(PROOF_RATE_LIMIT_MESSAGE)) {
    return {
      retry: true,
      delayMs: PROOF_RATE_LIMIT_RETRY_DELAY_MS,
    };
  }

  if (normalizedReason.includes(FINALIZATION_DELAY_MESSAGE)) {
    if (elapsedMs >= MERKLE_FINALIZATION_MAX_WAIT_MS) {
      return {
        retry: false,
        errorMessage:
          "Commitment is still not finalized after 10 minutes. Maintainer may be stalled; retry later.",
      };
    }
    return {
      retry: true,
      delayMs: MERKLE_FINALIZATION_RETRY_DELAY_MS,
    };
  }

  return { retry: false };
}

export function getMerkleProofRetryStatus(rawReason: string, delayMs: number, elapsedMs: number): string {
  const normalizedReason = rawReason.trim().toLowerCase();
  const delaySeconds = Math.ceil(delayMs / 1000);

  if (normalizedReason.includes(FINALIZATION_DELAY_MESSAGE)) {
    return `Deposit found. Waiting for maintainer to finalize Merkle root (${formatElapsed(elapsedMs)} elapsed). Auto-retrying in ${delaySeconds}s...`;
  }

  if (normalizedReason.includes(PROOF_RATE_LIMIT_MESSAGE)) {
    return `Relayer proof endpoint is rate-limiting. Auto-retrying in ${delaySeconds}s...`;
  }

  return `Retrying Merkle proof lookup in ${delaySeconds}s...`;
}
