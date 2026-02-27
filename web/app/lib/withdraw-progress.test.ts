import { describe, expect, it } from "vitest";

import {
  WITHDRAW_STEP_SEQUENCE,
  getWithdrawFailureCopy,
  getWithdrawStepCopy,
  getWithdrawStepVisualState,
} from "./withdraw-progress";

describe("withdraw progress helpers", () => {
  it("provides stage-specific progress copy", () => {
    expect(getWithdrawStepCopy("fetch_merkle").progress).toContain("Merkle proof");
    expect(getWithdrawStepCopy("fetch_merkle").expectedDuration).toContain("1s");
    expect(getWithdrawStepCopy("generate_proof").progress).toContain("Generating Groth16 proof");
    expect(getWithdrawStepCopy("generate_proof").expectedDuration).toContain("2-20s");
    expect(getWithdrawStepCopy("submit_to_relayer").progress).toContain("Submitting withdrawal proof");
    expect(getWithdrawStepCopy("submit_to_relayer").expectedDuration).toContain("10-15s");
  });

  it("formats stage-aware error messages and hints", () => {
    const copy = getWithdrawFailureCopy("generate_proof", "witness mismatch");
    expect(copy.message).toContain("Proof generation failed");
    expect(copy.message).toContain("witness mismatch");
    expect(copy.hint).toContain("Privacy Ticket");
  });

  it("falls back to a generic failure message when no stage is known", () => {
    const copy = getWithdrawFailureCopy(null, "unexpected");
    expect(copy.message).toBe("Withdraw failed: unexpected");
    expect(copy.hint).toContain("Retry");
  });

  it("surfaces origin allowlist guidance for fetch-merkle failures", () => {
    const copy = getWithdrawFailureCopy("fetch_merkle", "Origin not allowed.");
    expect(copy.message).toContain("Merkle proof lookup failed");
    expect(copy.hint).toContain("RELAYER_ALLOWED_ORIGINS");
  });

  it("surfaces root-finalization guidance for fetch-merkle failures", () => {
    const copy = getWithdrawFailureCopy(
      "fetch_merkle",
      "Commitment is not yet included in a finalized Merkle root. Retry shortly.",
    );
    expect(copy.message).toContain("Merkle proof lookup failed");
    expect(copy.hint).toContain("auto-retries");
  });

  it("surfaces timeout guidance when finalization retries are exhausted", () => {
    const copy = getWithdrawFailureCopy(
      "fetch_merkle",
      "Commitment is still not finalized after 10 minutes. Maintainer may be stalled; retry later.",
    );
    expect(copy.message).toContain("Merkle proof lookup failed");
    expect(copy.hint).toContain("timed out");
  });

  it("surfaces proof rate-limit guidance for fetch-merkle failures", () => {
    const copy = getWithdrawFailureCopy("fetch_merkle", "Too many proof requests. Retry later.");
    expect(copy.message).toContain("Merkle proof lookup failed");
    expect(copy.hint).toContain("rate-limiting");
  });

  it("marks previous steps complete while a later step is active", () => {
    const [fetchStep, proveStep, submitStep] = WITHDRAW_STEP_SEQUENCE;

    expect(getWithdrawStepVisualState(fetchStep, proveStep, null, false)).toBe("done");
    expect(getWithdrawStepVisualState(proveStep, proveStep, null, false)).toBe("active");
    expect(getWithdrawStepVisualState(submitStep, proveStep, null, false)).toBe("pending");
  });

  it("marks the failed step while preserving completed predecessors", () => {
    const [fetchStep, proveStep, submitStep] = WITHDRAW_STEP_SEQUENCE;

    expect(getWithdrawStepVisualState(fetchStep, null, submitStep, false)).toBe("done");
    expect(getWithdrawStepVisualState(proveStep, null, submitStep, false)).toBe("done");
    expect(getWithdrawStepVisualState(submitStep, null, submitStep, false)).toBe("failed");
  });

  it("marks every step done after completion", () => {
    for (const step of WITHDRAW_STEP_SEQUENCE) {
      expect(getWithdrawStepVisualState(step, null, null, true)).toBe("done");
    }
  });
});
