import { describe, expect, it } from "vitest";

import { summarizeRelayConfigFailure } from "./relay-config";

describe("summarizeRelayConfigFailure", () => {
  it("extracts issues from relay config payload", () => {
    const result = summarizeRelayConfigFailure(
      {
        error: "Relayer is not fully configured.",
        issues: ["RELAYER_WIF is required.", "KV_REST_API_TOKEN is required."],
      },
      "Relayer unavailable.",
    );

    expect(result.message).toBe("Relayer is not fully configured.");
    expect(result.issues).toEqual([
      "RELAYER_WIF is required.",
      "KV_REST_API_TOKEN is required.",
    ]);
  });

  it("deduplicates and trims issue lines", () => {
    const result = summarizeRelayConfigFailure(
      {
        error: "bad",
        issues: ["  A  ", "A", "", "B"],
      },
      "fallback",
    );

    expect(result.issues).toEqual(["A", "B"]);
  });

  it("falls back cleanly when payload is missing", () => {
    const result = summarizeRelayConfigFailure(null, "Relayer unavailable.");

    expect(result.message).toBe("Relayer unavailable.");
    expect(result.issues).toEqual([]);
  });
});
