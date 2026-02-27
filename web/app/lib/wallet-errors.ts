function extractErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const candidate = error as { description?: unknown; message?: unknown };
    if (typeof candidate.description === "string" && candidate.description.length > 0) {
      return candidate.description;
    }
    if (typeof candidate.message === "string" && candidate.message.length > 0) {
      return candidate.message;
    }
  }
  return "";
}

function resolveExpectedNetworkLabel(networkMagic: number | null): string {
  if (networkMagic === 894710606) return "Neo N3 TestNet";
  if (networkMagic === 860833102) return "Neo N3 MainNet";
  return "the same Neo N3 network as this app";
}

export function getWalletConnectErrorMessage(error: unknown, networkMagic: number | null, fallback: string): string {
  const rawMessage = extractErrorMessage(error);
  const normalized = rawMessage.toLowerCase();
  const expectedNetwork = resolveExpectedNetworkLabel(networkMagic);

  const hasNetworkSignal =
    normalized.includes("dapi provider refused to process this request") ||
    normalized.includes("network mismatch") ||
    normalized.includes("wrong network") ||
    normalized.includes("unsupported chain") ||
    normalized.includes("chain mismatch");

  if (hasNetworkSignal) {
    return `Wrong wallet network selected. Switch NeoLine to ${expectedNetwork} and try again.`;
  }

  return rawMessage || fallback;
}
