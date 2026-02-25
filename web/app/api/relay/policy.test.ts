import { describe, expect, it } from "vitest";
import { getClientIpFromHeaders, isOriginAllowed, parseOriginAllowlist, parseBearerToken, readApiCredential } from "./policy";

describe("relay policy helpers", () => {
  it("extracts first forwarded ip in vercel runtime", () => {
    const headers = new Headers({
      "x-vercel-forwarded-for": "203.0.113.8, 10.0.0.5",
    });

    const ip = getClientIpFromHeaders(headers, { isVercelRuntime: true, trustProxyHeaders: true });
    expect(ip).toBe("203.0.113.8");
  });

  it("returns unknown when proxy headers are untrusted", () => {
    const headers = new Headers({
      "x-forwarded-for": "203.0.113.8",
      "x-real-ip": "203.0.113.9",
    });

    const ip = getClientIpFromHeaders(headers, { isVercelRuntime: false, trustProxyHeaders: false });
    expect(ip).toBe("unknown");
  });

  it("accepts exact and wildcard origin allowlist entries", () => {
    const allowlist = parseOriginAllowlist("https://app.example.com,https://*.trusted.example");
    expect(allowlist).not.toBeNull();

    const exactHeaders = new Headers({ origin: "https://app.example.com" });
    expect(isOriginAllowed(exactHeaders, allowlist)).toBe(true);

    const wildcardHeaders = new Headers({ origin: "https://sub.trusted.example" });
    expect(isOriginAllowed(wildcardHeaders, allowlist)).toBe(true);

    const deniedHeaders = new Headers({ origin: "https://evil.example" });
    expect(isOriginAllowed(deniedHeaders, allowlist)).toBe(false);
  });

  it("prefers x-relayer-api-key over bearer token", () => {
    const headers = new Headers({
      "x-relayer-api-key": "header-secret",
      authorization: "Bearer bearer-secret",
    });

    expect(readApiCredential(headers)).toBe("header-secret");
  });

  it("parses bearer token and rejects malformed values", () => {
    expect(parseBearerToken("Bearer token-value")).toBe("token-value");
    expect(parseBearerToken("Basic token-value")).toBeNull();
    expect(parseBearerToken(null)).toBeNull();
  });
});
