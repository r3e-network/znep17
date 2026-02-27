export type RelayConfigFailurePayload = {
  error?: unknown;
  issues?: unknown;
};

export type RelayConfigFailureSummary = {
  message: string;
  issues: string[];
};

function normalizeIssueList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const issues: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    issues.push(normalized);
  }

  return issues;
}

export function summarizeRelayConfigFailure(
  payload: RelayConfigFailurePayload | null | undefined,
  fallbackMessage: string,
): RelayConfigFailureSummary {
  const message =
    payload && typeof payload.error === "string" && payload.error.trim().length > 0
      ? payload.error.trim()
      : fallbackMessage;

  return {
    message,
    issues: normalizeIssueList(payload?.issues),
  };
}
