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
    expect(getWithdrawStepCopy("generate_proof").progress).toContain("Generating Groth16 proof");
    expect(getWithdrawStepCopy("submit_to_relayer").progress).toContain("Submitting withdrawal proof");
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
