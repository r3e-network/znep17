import { describe, expect, it } from "vitest";

import {
  MERKLE_FINALIZATION_MAX_WAIT_MS,
  MERKLE_FINALIZATION_RETRY_DELAY_MS,
  PROOF_RATE_LIMIT_RETRY_DELAY_MS,
  getMerkleProofRetryDecision,
  getMerkleProofRetryStatus,
} from "./withdraw-retry";

describe("withdraw merkle-proof retry policy", () => {
  it("retries finalization delays before timeout", () => {
    const decision = getMerkleProofRetryDecision(
      "Commitment is not yet included in a finalized Merkle root. Retry shortly.",
      MERKLE_FINALIZATION_MAX_WAIT_MS - 1,
    );

    expect(decision.retry).toBe(true);
    expect(decision.delayMs).toBe(MERKLE_FINALIZATION_RETRY_DELAY_MS);
  });

  it("stops retrying finalization delays after timeout", () => {
    const decision = getMerkleProofRetryDecision(
      "Commitment is not yet included in a finalized Merkle root. Retry shortly.",
      MERKLE_FINALIZATION_MAX_WAIT_MS + 1,
    );

    expect(decision.retry).toBe(false);
    expect(decision.errorMessage).toContain("still not finalized");
  });

  it("retries proof endpoint rate limiting", () => {
    const decision = getMerkleProofRetryDecision("Too many proof requests. Retry later.", 0);
    expect(decision.retry).toBe(true);
    expect(decision.delayMs).toBe(PROOF_RATE_LIMIT_RETRY_DELAY_MS);
  });

  it("does not retry unknown errors", () => {
    const decision = getMerkleProofRetryDecision("Origin not allowed.", 0);
    expect(decision.retry).toBe(false);
  });

  it("builds user-facing status for finalization waits", () => {
    const status = getMerkleProofRetryStatus(
      "Commitment is not yet included in a finalized Merkle root. Retry shortly.",
      MERKLE_FINALIZATION_RETRY_DELAY_MS,
      95_000,
    );
    expect(status).toContain("Deposit found");
    expect(status).toContain("1:35");
    expect(status).toContain("Auto-retrying");
  });

  it("builds user-facing status for rate limits", () => {
    const status = getMerkleProofRetryStatus(
      "Too many proof requests. Retry later.",
      PROOF_RATE_LIMIT_RETRY_DELAY_MS,
      0,
    );
    expect(status).toContain("rate-limiting");
    expect(status).toContain("65s");
  });
});
