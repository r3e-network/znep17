const HASH160_HEX_RE = /^(?:0x)?[0-9a-fA-F]{40}$/;
const SECRET_RE = /^[0-9a-fA-F]{1,64}$/;
const DECIMAL_RE = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const TICKET_PREFIX = "znep17-";

const TOKEN_GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const TOKEN_NEO = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

export type ParsedPrivacyTicket = {
  secretHex: string;
  nullifierHex: string;
  amount: string;
  tokenHash: string;
};

export type ParsePrivacyTicketResult = {
  complete: boolean;
  error: string | null;
  ticket: ParsedPrivacyTicket | null;
};

export type StoredPrivacyTicketParts = {
  secretHex?: string | null;
  nullifierHex?: string | null;
  amount?: string | null;
  tokenHash?: string | null;
};

export function isSupportedTicketTokenHash(tokenHash: string): boolean {
  const normalized = tokenHash.trim().toLowerCase();
  return normalized === TOKEN_GAS || normalized === TOKEN_NEO;
}

export function formatPrivacyTicket(ticket: ParsedPrivacyTicket): string {
  return `${TICKET_PREFIX}${ticket.secretHex}-${ticket.nullifierHex}-${ticket.amount}-${ticket.tokenHash}`;
}

export function buildAutofillPrivacyTicket(parts: StoredPrivacyTicketParts): string | null {
  const secretHex = (parts.secretHex || "").trim().toLowerCase();
  const nullifierHex = (parts.nullifierHex || "").trim().toLowerCase();
  const amount = (parts.amount || "").trim();
  const tokenHash = (parts.tokenHash || "").trim().toLowerCase();

  if (!SECRET_RE.test(secretHex) || !SECRET_RE.test(nullifierHex)) return null;
  if (!DECIMAL_RE.test(amount)) return null;
  if (!HASH160_HEX_RE.test(tokenHash)) return null;
  if (!isSupportedTicketTokenHash(tokenHash)) return null;

  return formatPrivacyTicket({
    secretHex,
    nullifierHex,
    amount,
    tokenHash: tokenHash.startsWith("0x") ? tokenHash : `0x${tokenHash}`,
  });
}

export function parsePrivacyTicket(raw: string): ParsePrivacyTicketResult {
  const value = raw.trim();
  if (!value) {
    return { complete: false, error: null, ticket: null };
  }

  const normalized = value.toLowerCase().startsWith(TICKET_PREFIX)
    ? value.slice(TICKET_PREFIX.length)
    : value;
  const parts = normalized.split("-");

  if (parts.length < 4) {
    return { complete: false, error: null, ticket: null };
  }
  if (parts.length !== 4) {
    return { complete: true, error: "Privacy Ticket format is invalid.", ticket: null };
  }

  const [secretHexRaw, nullifierHexRaw, amountRaw, tokenHashRaw] = parts;
  const secretHex = secretHexRaw.trim().toLowerCase();
  const nullifierHex = nullifierHexRaw.trim().toLowerCase();
  const amount = amountRaw.trim();
  const tokenHash = tokenHashRaw.trim().toLowerCase();

  if (!SECRET_RE.test(secretHex) || !SECRET_RE.test(nullifierHex)) {
    return { complete: true, error: "Privacy Ticket secret/nullifier format is invalid.", ticket: null };
  }
  if (!DECIMAL_RE.test(amount)) {
    return { complete: true, error: "Privacy Ticket amount format is invalid.", ticket: null };
  }
  if (!HASH160_HEX_RE.test(tokenHash)) {
    return { complete: true, error: "Privacy Ticket token hash format is invalid.", ticket: null };
  }
  if (!isSupportedTicketTokenHash(tokenHash)) {
    return { complete: true, error: "Privacy Ticket asset is not supported by this app. Please use GAS or NEO.", ticket: null };
  }

  return {
    complete: true,
    error: null,
    ticket: { secretHex, nullifierHex, amount, tokenHash: tokenHash.startsWith("0x") ? tokenHash : `0x${tokenHash}` },
  };
}
