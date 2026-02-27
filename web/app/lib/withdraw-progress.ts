export type WithdrawStep = "fetch_merkle" | "generate_proof" | "submit_to_relayer";

export type WithdrawStepVisualState = "pending" | "active" | "done" | "failed";

type WithdrawStepCopy = {
  label: string;
  progress: string;
  errorPrefix: string;
  hint: string;
};

export const WITHDRAW_STEP_SEQUENCE: WithdrawStep[] = [
  "fetch_merkle",
  "generate_proof",
  "submit_to_relayer",
];

const WITHDRAW_STEP_COPY: Record<WithdrawStep, WithdrawStepCopy> = {
  fetch_merkle: {
    label: "Fetch Merkle Proof",
    progress: "Fetching Merkle proof from relayer...",
    errorPrefix: "Merkle proof lookup failed",
    hint: "Check relayer availability and ensure your note has been indexed, then retry.",
  },
  generate_proof: {
    label: "Generate Proof",
    progress: "Generating Groth16 proof in your browser...",
    errorPrefix: "Proof generation failed",
    hint: "Confirm your Privacy Ticket values and browser memory, then retry proof generation.",
  },
  submit_to_relayer: {
    label: "Submit to Relayer",
    progress: "Submitting withdrawal proof to relayer...",
    errorPrefix: "Relay submission failed",
    hint: "Verify relayer policy/network health and Retry once the relayer is healthy.",
  },
};

export function getWithdrawStepCopy(step: WithdrawStep): WithdrawStepCopy {
  return WITHDRAW_STEP_COPY[step];
}

export function getWithdrawFailureCopy(
  step: WithdrawStep | null,
  reason: string,
): {
  message: string;
  hint: string;
} {
  const normalizedReason = reason.trim().length > 0 ? reason.trim() : "Unknown error.";
  const normalizedReasonLower = normalizedReason.toLowerCase();
  if (!step) {
    return {
      message: `Withdraw failed: ${normalizedReason}`,
      hint: "Retry after checking your ticket data, recipient, and relayer connection.",
    };
  }

  const stepCopy = getWithdrawStepCopy(step);
  if (step === "fetch_merkle" && normalizedReasonLower.includes("origin not allowed")) {
    return {
      message: `${stepCopy.errorPrefix}: ${normalizedReason}`,
      hint: "Relayer blocked this website origin. Add your site origin to RELAYER_ALLOWED_ORIGINS (and MAINTAINER_ALLOWED_ORIGINS), then retry.",
    };
  }
  if (
    step === "fetch_merkle" &&
    normalizedReasonLower.includes("not yet included in a finalized merkle root")
  ) {
    return {
      message: `${stepCopy.errorPrefix}: ${normalizedReason}`,
      hint: "Your deposit is confirmed but not finalized for withdrawal yet. Wait for maintainer root update, then retry.",
    };
  }
  return {
    message: `${stepCopy.errorPrefix}: ${normalizedReason}`,
    hint: stepCopy.hint,
  };
}

export function getWithdrawStepVisualState(
  step: WithdrawStep,
  activeStep: WithdrawStep | null,
  failedStep: WithdrawStep | null,
  completed: boolean,
): WithdrawStepVisualState {
  if (completed) return "done";

  const stepIndex = WITHDRAW_STEP_SEQUENCE.indexOf(step);

  if (failedStep) {
    const failedIndex = WITHDRAW_STEP_SEQUENCE.indexOf(failedStep);
    if (stepIndex < failedIndex) return "done";
    if (stepIndex === failedIndex) return "failed";
    return "pending";
  }

  if (!activeStep) return "pending";
  const activeIndex = WITHDRAW_STEP_SEQUENCE.indexOf(activeStep);
  if (stepIndex < activeIndex) return "done";
  if (stepIndex === activeIndex) return "active";
  return "pending";
}
