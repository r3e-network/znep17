import { describe, expect, it } from "vitest";
import { getWalletConnectErrorMessage } from "./wallet-errors";

describe("wallet error helpers", () => {
  it("maps dAPI provider refusal to a clear network guidance message", () => {
    const message = getWalletConnectErrorMessage(
      { message: "The dAPI provider refused to process this request." },
      894710606,
      "Failed to connect wallet",
    );

    expect(message).toContain("Wrong wallet network selected");
    expect(message).toContain("Neo N3 TestNet");
  });

  it("maps generic network mismatch errors to a clear network guidance message", () => {
    const message = getWalletConnectErrorMessage(
      { description: "network mismatch: unsupported chain" },
      860833102,
      "Failed to connect wallet",
    );

    expect(message).toContain("Wrong wallet network selected");
    expect(message).toContain("Neo N3 MainNet");
  });

  it("returns provider description when no network mismatch signal exists", () => {
    const message = getWalletConnectErrorMessage(
      { description: "User rejected request" },
      894710606,
      "Failed to connect wallet",
    );

    expect(message).toBe("User rejected request");
  });

  it("returns fallback when no message is available", () => {
    expect(getWalletConnectErrorMessage(null, null, "Failed to connect wallet")).toBe("Failed to connect wallet");
  });
});
