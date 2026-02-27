import { describe, expect, it } from "vitest";
import { buildAutofillPrivacyTicket, formatPrivacyTicket, parsePrivacyTicket } from "./privacy-ticket";

describe("privacy ticket helpers", () => {
  it("formats a ticket string", () => {
    const ticket = formatPrivacyTicket({
      secretHex: "aa",
      nullifierHex: "bb",
      amount: "10.5",
      tokenHash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
    });

    expect(ticket).toBe("znep17-aa-bb-10.5-0xd2a4cff31913016155e38e474a2c06d08be276cf");
  });

  it("parses a valid complete ticket", () => {
    const result = parsePrivacyTicket("znep17-aa-bb-10.5-0xD2A4cFf31913016155E38E474a2c06d08BE276CF");

    expect(result.complete).toBe(true);
    expect(result.error).toBeNull();
    expect(result.ticket).toEqual({
      secretHex: "aa",
      nullifierHex: "bb",
      amount: "10.5",
      tokenHash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
    });
  });

  it("treats partial input as incomplete instead of invalid", () => {
    const result = parsePrivacyTicket("znep17-aa-bb");
    expect(result.complete).toBe(false);
    expect(result.error).toBeNull();
    expect(result.ticket).toBeNull();
  });

  it("rejects unsupported token hashes", () => {
    const result = parsePrivacyTicket("znep17-aa-bb-10-0x1111111111111111111111111111111111111111");
    expect(result.complete).toBe(true);
    expect(result.error).toContain("GAS or NEO");
    expect(result.ticket).toBeNull();
  });

  it("builds an autofill ticket from valid stored values", () => {
    const ticket = buildAutofillPrivacyTicket({
      secretHex: "AA",
      nullifierHex: "BB",
      amount: "10",
      tokenHash: "0xD2A4cFf31913016155E38E474a2c06d08BE276CF",
    });

    expect(ticket).toBe("znep17-aa-bb-10-0xd2a4cff31913016155e38e474a2c06d08be276cf");
  });

  it("returns null when stored ticket values are incomplete", () => {
    const ticket = buildAutofillPrivacyTicket({
      secretHex: "aa",
      nullifierHex: "bb",
      amount: "",
      tokenHash: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
    });

    expect(ticket).toBeNull();
  });
});
