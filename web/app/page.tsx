"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet, ArrowRight, Shield, Activity, X, RefreshCw, Copy, Check, Info, FileText } from "lucide-react";
import { wallet } from "@cityofzion/neon-js";
import { poseidon1Bls, poseidon4Bls } from "./lib/blsPoseidon";
import { summarizeRelayConfigFailure } from "./lib/relay-config";
import { getWalletConnectErrorMessage } from "./lib/wallet-errors";
import { buildAutofillPrivacyTicket, formatPrivacyTicket, parsePrivacyTicket } from "./lib/privacy-ticket";
import {
  getMerkleProofRetryDecision,
  getMerkleProofRetryStatus,
  MERKLE_FINALIZATION_MAX_WAIT_MS,
} from "./lib/withdraw-retry";
import {
  WITHDRAW_STEP_SEQUENCE,
  getWithdrawFailureCopy,
  getWithdrawStepCopy,
  getWithdrawStepVisualState,
  type WithdrawStep,
} from "./lib/withdraw-progress";

type NeoLineAccount = { address: string; label: string };

type NeoLineInvokeArgs = {
  scriptHash: string;
  operation: string;
  args: unknown[];
  signers: Array<{ account: string; scopes: number }>;
};

type NeoLineClient = {
  getAccount: () => Promise<NeoLineAccount>;
  invoke: (args: NeoLineInvokeArgs) => Promise<{ txid: string }>;
};

type NeoLineGlobal = {
  Init: new () => NeoLineClient;
};

type ProofMode = "snark";

type RelayConfigResponse = {
  configured?: boolean;
  relayerAddress?: string;
  vaultHash?: string;
  currentRoot?: string | null;
  networkMagic?: number;
  proofMode?: "snark";
  guardStoreMode?: string;
  requiresApiKey?: boolean;
  issues?: string[];
  error?: string;
};

type Groth16ProofLike = {
  pi_a: unknown[];
  pi_b: unknown[];
  pi_c: unknown[];
  protocol: string;
  curve: string;
};

declare global {
  interface Window {
    NEOLineN3?: NeoLineGlobal;
  }
}

const TOKEN_DEFAULT = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const TOKEN_GAS = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const TOKEN_NEO = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const RELAYER_FEE_FIXED8 = "100000000";
const MERKLE_FINALIZATION_MAX_WAIT_MINUTES = Math.floor(MERKLE_FINALIZATION_MAX_WAIT_MS / 60_000);
const LEGACY_PENDING_KEY = "znep17_has_pending";
const LEGACY_LAST_SECRET_KEY = "znep17_last_secret";
const LEGACY_LAST_NULLIFIER_KEY = "znep17_last_nullifier";
const LEGACY_LAST_AMOUNT_KEY = "znep17_last_amount";
const LEGACY_LAST_TOKEN_KEY = "znep17_last_token";
const HASH160_HEX_RE = /^(?:0x)?[0-9a-fA-F]{40}$/;
const HEX_32_RE = /^[0-9a-fA-F]{64}$/;
const SECRET_RE = /^[0-9a-fA-F]{1,64}$/;
const DECIMAL_RE = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const EXPLORER_TX_BASE_OVERRIDE = sanitizeExplorerTxBaseUrl(process.env.NEXT_PUBLIC_EXPLORER_TX_BASE_URL || "");
const EXPLORER_TX_BASE_BY_NETWORK_MAGIC: Record<number, string> = {
  894710606: "https://testnet.neotube.io/transaction/",
  860833102: "https://ndora.org/transaction/",
};
const PUBLIC_BASE_PATH = normalizeBasePath(process.env.NEXT_PUBLIC_BASE_PATH || "");
const ALLOW_CUSTOM_VAULT_HASH = (process.env.NEXT_PUBLIC_ALLOW_CUSTOM_VAULT_HASH || "").trim().toLowerCase() === "true";

function normalizeHash160(input: string, fieldName: string): string {
  const trimmed = input.trim();
  if (!HASH160_HEX_RE.test(trimmed)) {
    throw new Error(`${fieldName} must be a valid 20-byte script hash`);
  }

  return trimmed.replace(/^0x/i, "").toLowerCase();
}

function toHash160(addressOrHash: string, fieldName: string): string {
  const trimmed = addressOrHash.trim();
  if (wallet.isAddress(trimmed)) {
    return wallet.getScriptHashFromAddress(trimmed);
  }

  return normalizeHash160(trimmed, fieldName);
}

function decimalToFixed8(raw: string): string {
  const value = raw.trim();
  if (!DECIMAL_RE.test(value)) {
    throw new Error("Amount must be a valid number");
  }

  const [wholeRaw, fractionRaw = ""] = value.split(".");
  if (fractionRaw.length > 8) {
    throw new Error("Amount supports up to 8 decimal places");
  }

  const whole = wholeRaw.replace(/^0+(?=\d)/, "") || "0";
  const atomic = BigInt(`${whole}${fractionRaw.padEnd(8, "0")}`);
  if (atomic <= 0n) {
    throw new Error("Amount must be greater than 0");
  }

  return atomic.toString();
}

function hexToBase64(hex: string): string {
  if (!/^[0-9a-fA-F]*$/.test(hex) || hex.length % 2 !== 0) {
    throw new Error("Leaf must be valid even-length hex");
  }

  let binary = "";
  for (let i = 0; i < hex.length; i += 2) {
    binary += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return btoa(binary);
}

function randomHex(bytes: number): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return Array.from(value, (n) => n.toString(16).padStart(2, "0")).join("");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeBasePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "";
}

function getTicketStorageKey(address: string): string {
  return `znep17_ticket_${address.trim().toLowerCase()}`;
}

function getTicketPendingStorageKey(address: string): string {
  return `znep17_ticket_pending_${address.trim().toLowerCase()}`;
}

function withBasePath(path: string): string {
  if (!path.startsWith("/")) {
    return `${PUBLIC_BASE_PATH}/${path}`;
  }
  return `${PUBLIC_BASE_PATH}${path}`;
}

function sanitizeExplorerTxBaseUrl(raw: string): string {
  const value = raw.trim();
  if (!value) return "";

  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function buildRelayHeaders(includeJsonContentType = false): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJsonContentType) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

function buildExplorerTxUrl(txHash: string, networkMagic: number | null): string {
  let base = EXPLORER_TX_BASE_OVERRIDE;
  if (!base && networkMagic !== null && typeof EXPLORER_TX_BASE_BY_NETWORK_MAGIC[networkMagic] === "string") {
    base = EXPLORER_TX_BASE_BY_NETWORK_MAGIC[networkMagic];
  }
  if (!base) {
    base = EXPLORER_TX_BASE_BY_NETWORK_MAGIC[894710606];
  }
  return `${base.replace(/\/?$/, "/")}${encodeURIComponent(txHash)}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object") {
    const candidate = error as { description?: unknown; message?: unknown };
    if (typeof candidate.description === "string" && candidate.description.length > 0) {
      return candidate.description;
    }
    if (typeof candidate.message === "string" && candidate.message.length > 0) {
      return candidate.message;
    }
  }
  return fallback;
}

function isSupportedTokenHash(input: string): boolean {
  const normalized = input.trim().toLowerCase();
  return normalized === TOKEN_GAS || normalized === TOKEN_NEO;
}

type MerkleProofResponse = {
  leafIndex: number;
  root: string;
  rootDecimal: string;
  pathElements: string[];
  pathIndices: number[];
  leafCount: number;
};

type NoteArtifacts = {
  nullifierHashDecimal: string;
  nullifierHashHex: string;
  assetDecimal: string;
  commitmentDecimal: string;
  commitmentHex: string;
};

async function deriveNoteArtifacts(
  secretHex: string,
  nullifierHex: string,
  amountFixed8: string,
  assetScriptHash: string,
): Promise<NoteArtifacts> {
  const normalizedNullifier = nullifierHex.trim().toLowerCase();
  const normalizedSecret = secretHex.trim().toLowerCase();
  if (!SECRET_RE.test(normalizedNullifier) || !SECRET_RE.test(normalizedSecret)) {
    throw new Error("Secret and nullifier must be valid hex values");
  }

  const nulBigInt = BigInt(`0x${normalizedNullifier}`);
  const secBigInt = BigInt(`0x${normalizedSecret}`);
  const amountBigInt = BigInt(amountFixed8);
  const assetBigInt = BigInt(`0x${assetScriptHash}`);

  const nullifierHashField = poseidon1Bls([nulBigInt]);
  const nullifierHashDecimal = nullifierHashField.toString();
  const nullifierHashHex = nullifierHashField.toString(16).padStart(64, "0");

  const commitmentField = poseidon4Bls([nulBigInt, secBigInt, amountBigInt, assetBigInt]);
  const commitmentDecimal = commitmentField.toString();
  const commitmentHex = commitmentField.toString(16).padStart(64, "0");

  return {
    nullifierHashDecimal,
    nullifierHashHex,
    assetDecimal: assetBigInt.toString(),
    commitmentDecimal,
    commitmentHex,
  };
}

async function fetchMerkleProofFromRelay(commitmentHex: string): Promise<MerkleProofResponse> {
  const res = await fetch(`/api/relay?proof=${encodeURIComponent(commitmentHex)}`, {
    method: "GET",
    cache: "no-store",
    headers: buildRelayHeaders(),
  });
  const data = (await res.json()) as MerkleProofResponse & { error?: string };
  if (!res.ok || !Array.isArray(data.pathElements)) {
    throw new Error((data as { error?: string }).error || "Failed to fetch Merkle proof from relay");
  }
  return data;
}

export default function Home() {
  const [account, setAccount] = useState<NeoLineAccount | null>(null);
    const [amount, setAmount] = useState("10");
  const [tokenHash, setTokenHash] = useState(TOKEN_DEFAULT);
  const [vaultHash, setVaultHash] = useState("");
  const [relayVaultHash, setRelayVaultHash] = useState("");
  const [stealthAddress, setStealthAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");

  const [recipient, setRecipient] = useState("");
  const [relayer, setRelayer] = useState("");
  const [relayLoading, setRelayLoading] = useState(true);
  const [relayIssues, setRelayIssues] = useState<string[]>([]);
  const [proofMode, setProofMode] = useState<ProofMode>("snark");
  const [networkMagic, setNetworkMagic] = useState<number | null>(null);
  const [currentRootHex, setCurrentRootHex] = useState("");

  const [withdrawActiveStep, setWithdrawActiveStep] = useState<WithdrawStep | null>(null);
  const [withdrawFailedStep, setWithdrawFailedStep] = useState<WithdrawStep | null>(null);
  const [withdrawCompleted, setWithdrawCompleted] = useState(false);
  const [withdrawFailureHint, setWithdrawFailureHint] = useState("");
  const [withdrawStatusHint, setWithdrawStatusHint] = useState("");
  const [secretHex, setSecretHex] = useState("");
  const [nullifierPrivHex, setNullifierPrivHex] = useState("");
  const [ticketAmount, setTicketAmount] = useState("");
  const [ticketAsset, setTicketAsset] = useState("");
  const [ticketInput, setTicketInput] = useState("");
  const [copiedKey, setCopiedKey] = useState<"ticket" | "secret" | "nullifier" | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const getTicketString = () => {
    if (!secretHex || !nullifierPrivHex || !ticketAmount || !ticketAsset) return "";
    return formatPrivacyTicket({
      secretHex: secretHex.trim().toLowerCase(),
      nullifierHex: nullifierPrivHex.trim().toLowerCase(),
      amount: ticketAmount.trim(),
      tokenHash: ticketAsset.trim().toLowerCase(),
    });
  };

  const handleTicketInput = (val: string) => {
    setTicketInput(val);
    setSecretHex("");
    setNullifierPrivHex("");
    setTicketAmount("");
    setTicketAsset("");
    const parsed = parsePrivacyTicket(val);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    if (!parsed.complete || !parsed.ticket) return;

    const ticket = parsed.ticket;
    const normalizedToken = ticket.tokenHash.trim().toLowerCase();
    setError("");
    setSecretHex(ticket.secretHex);
    setNullifierPrivHex(ticket.nullifierHex);
    setTicketAmount(ticket.amount);
    setTicketAsset(normalizedToken);
    setAmount(ticket.amount);
    if (isSupportedTokenHash(normalizedToken)) {
      setTokenHash(normalizedToken);
    }
    const normalizedTicket = formatPrivacyTicket(ticket);
    setTicketInput(normalizedTicket);
    if (account?.address) {
      localStorage.setItem(getTicketStorageKey(account.address), normalizedTicket);
      localStorage.setItem(getTicketPendingStorageKey(account.address), "true");
    }
  };

  const handleCopy = async (text: string, type: "ticket" | "secret" | "nullifier") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(type);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error("Failed to copy text", err);
    }
  };

  const loadRelayConfig = useCallback(async (): Promise<RelayConfigResponse | null> => {
    setRelayLoading(true);
    try {
      const res = await fetch("/api/relay", { method: "GET", cache: "no-store", headers: buildRelayHeaders() });
      const data = (await res.json()) as RelayConfigResponse;
      const summary = summarizeRelayConfigFailure(data, "Relayer unavailable.");

      if (!res.ok || !data.configured || !data.relayerAddress || !wallet.isAddress(data.relayerAddress)) {
        setRelayIssues(summary.issues);
        throw new Error(summary.message);
      }
      if (data.requiresApiKey) {
        setRelayIssues([
          "RELAYER_REQUIRE_AUTH is enabled. Public browser clients cannot send relayer API keys.",
          "Set RELAYER_REQUIRE_AUTH=false for public frontend usage.",
        ]);
        throw new Error("Relayer is configured for authenticated API clients only; direct browser mode is disabled.");
      }

      setRelayer(data.relayerAddress);
      if (typeof data.vaultHash === "string" && HASH160_HEX_RE.test(data.vaultHash)) {
        const relayVault = `0x${normalizeHash160(data.vaultHash, "Relayer vault hash")}`;
        setRelayVaultHash(relayVault);
        setVaultHash((prev) => {
          if (!ALLOW_CUSTOM_VAULT_HASH) {
            return relayVault;
          }
          return prev.length === 0 ? relayVault : prev;
        });
      } else {
        setRelayVaultHash("");
      }

      setProofMode("snark");
      setNetworkMagic(typeof data.networkMagic === "number" ? data.networkMagic : null);
      setRelayIssues([]);

      if (typeof data.currentRoot === "string" && HEX_32_RE.test(data.currentRoot.replace(/^0x/i, ""))) {
        setCurrentRootHex(data.currentRoot.replace(/^0x/i, "").toLowerCase());
      } else {
        setCurrentRootHex("");
      }

      setError("");
      return data;
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Failed to load relayer configuration");
      setError(message);
      return null;
    } finally {
      setRelayLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRelayConfig();
  }, [loadRelayConfig]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }
      void loadRelayConfig();
    }, 30_000);

    return () => clearInterval(timer);
  }, [loadRelayConfig]);

  useEffect(() => {
    const refreshNow = () => {
      void loadRelayConfig();
    };
    const handleVisibilityChange = () => {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "visible") {
        refreshNow();
      }
    };

    window.addEventListener("focus", refreshNow);
    window.addEventListener("online", refreshNow);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", refreshNow);
      window.removeEventListener("online", refreshNow);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadRelayConfig]);

  useEffect(() => {
    if (!account?.address) return;

    const address = account.address;
    const pendingKey = getTicketPendingStorageKey(address);
    const ticketKey = getTicketStorageKey(address);
    let pending = localStorage.getItem(pendingKey);
    let storedTicket = localStorage.getItem(ticketKey);

    if (!storedTicket && localStorage.getItem(LEGACY_PENDING_KEY) === "true") {
      const legacyTicket = buildAutofillPrivacyTicket({
        secretHex: localStorage.getItem(LEGACY_LAST_SECRET_KEY),
        nullifierHex: localStorage.getItem(LEGACY_LAST_NULLIFIER_KEY),
        amount: localStorage.getItem(LEGACY_LAST_AMOUNT_KEY),
        tokenHash: localStorage.getItem(LEGACY_LAST_TOKEN_KEY),
      });
      if (legacyTicket) {
        localStorage.setItem(ticketKey, legacyTicket);
        localStorage.setItem(pendingKey, "true");
        storedTicket = legacyTicket;
        pending = "true";
      }
      localStorage.removeItem(LEGACY_PENDING_KEY);
      localStorage.removeItem(LEGACY_LAST_SECRET_KEY);
      localStorage.removeItem(LEGACY_LAST_NULLIFIER_KEY);
      localStorage.removeItem(LEGACY_LAST_AMOUNT_KEY);
      localStorage.removeItem(LEGACY_LAST_TOKEN_KEY);
    }

    if (pending !== "true" || !storedTicket) return;

    setTicketInput(storedTicket);
    const parsed = parsePrivacyTicket(storedTicket);
    if (!parsed.ticket) return;

    const normalizedToken = parsed.ticket.tokenHash.trim().toLowerCase();
    setSecretHex(parsed.ticket.secretHex);
    setNullifierPrivHex(parsed.ticket.nullifierHex);
    setAmount(parsed.ticket.amount);
    setTicketAmount(parsed.ticket.amount);
    setTicketAsset(normalizedToken);
    if (isSupportedTokenHash(normalizedToken)) {
      setTokenHash(normalizedToken);
    }
  }, [account?.address]);

  const connectWallet = async () => {
    try {
      if (typeof window === "undefined" || !window.NEOLineN3) {
        throw new Error("NeoLine N3 wallet extension is not installed");
      }

      const neoline = new window.NEOLineN3.Init();
      const accountData = await neoline.getAccount();
      setAccount(accountData);
      if (!recipient) setRecipient(accountData.address);
      setError("");
    } catch (err: unknown) {
      setError(getWalletConnectErrorMessage(err, networkMagic, "Failed to connect wallet"));
    }
  };

  const handleDeposit = async () => {
    if (!account) return setError("Please connect wallet first");
    const finalStealthAddress = stealthAddress || account.address;
    if (!tokenHash || !vaultHash || !amount || !finalStealthAddress || !secretHex || !nullifierPrivHex) {
      const missing = [];
      if (!tokenHash) missing.push("Token");
      if (!vaultHash) missing.push("Vault Hash");
      if (!amount) missing.push("Amount");
      if (!finalStealthAddress) missing.push("Stealth Address");
      if (!secretHex || !nullifierPrivHex) missing.push("Privacy Ticket");
      return setError(`Please fill all fields. Missing: ${missing.join(", ")}`);
    }

    setLoading(true);
    setError("");
    setTxHash("");

    try {
      if (typeof window === "undefined" || !window.NEOLineN3) {
        throw new Error("NeoLine N3 wallet extension is not installed");
      }

      const neoline = new window.NEOLineN3.Init();
      if (!isSupportedTokenHash(tokenHash)) {
        throw new Error("Selected asset is not supported by this app. Please choose GAS or NEO.");
      }
      const senderScriptHash = wallet.getScriptHashFromAddress(account.address);
      const assetScriptHash = normalizeHash160(tokenHash, "Token script hash");
      const vaultScriptHash = normalizeHash160(vaultHash, "Vault contract hash");
      if (!ALLOW_CUSTOM_VAULT_HASH) {
        if (!relayVaultHash) {
          throw new Error("Vault hash is unavailable from relayer configuration. Refresh relay and retry.");
        }
        const relayVaultScriptHash = normalizeHash160(relayVaultHash, "Relayer vault hash");
        if (vaultScriptHash !== relayVaultScriptHash) {
          throw new Error("Vault hash mismatch with relayer configuration.");
        }
      }
      const stealthScriptHash = toHash160(finalStealthAddress, "Stealth address");
      const amountInt = decimalToFixed8(amount);
      const noteArtifacts = await deriveNoteArtifacts(secretHex, nullifierPrivHex, amountInt, assetScriptHash);
      const normalizedLeaf = noteArtifacts.commitmentHex;

      const result = await neoline.invoke({
        scriptHash: `0x${assetScriptHash}`,
        operation: "transfer",
        args: [
          { type: "Hash160", value: senderScriptHash },
          { type: "Hash160", value: vaultScriptHash },
          { type: "Integer", value: amountInt },
          {
            type: "Array",
            value: [
              { type: "Hash160", value: stealthScriptHash },
              { type: "ByteArray", value: hexToBase64(normalizedLeaf) },
            ],
          },
        ],
        signers: [{ account: senderScriptHash, scopes: 1 }],
      });

      setTxHash(result.txid);
      await loadRelayConfig();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Deposit failed");
      if (message.toLowerCase().includes("asset not allowed")) {
        setError(
          `Selected asset is not allowed by this vault on the connected network. Re-select GAS/NEO and confirm wallet network matches relayer network (${networkMagic ?? "unknown"}).`,
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawFailedStep(null);
    setWithdrawFailureHint("");
    setWithdrawStatusHint("");
    setWithdrawCompleted(false);

    if (!tokenHash || !amount || !recipient || !relayer || !secretHex || !nullifierPrivHex) {
      const missing = [];
      if (!tokenHash) missing.push("Token");
      if (!amount) missing.push("Amount");
      if (!recipient) missing.push("Recipient");
      if (!relayer) missing.push("Relayer");
      if (!secretHex || !nullifierPrivHex) missing.push("Privacy Ticket");
      return setError(`Please fill all required fields. Missing: ${missing.join(", ")}`);
    }
    if (relayLoading) return setError("Relayer configuration is still loading");

    setLoading(true);
    setError("");
    setTxHash("");
    let currentStep: WithdrawStep | null = "fetch_merkle";
    setWithdrawActiveStep(currentStep);

    try {
      if (!isSupportedTokenHash(tokenHash)) {
        throw new Error("Selected asset is not supported by this app. Please choose GAS or NEO.");
      }
      const assetScriptHash = normalizeHash160(tokenHash, "Token script hash");
      const recipientScriptHash = toHash160(recipient, "Recipient");
      const relayerScriptHash = toHash160(relayer, "Relayer");

      const noteAmountRaw = ticketAmount.trim().length > 0 ? ticketAmount : amount;
      const noteAmountInt = decimalToFixed8(noteAmountRaw);
      const amountInt = decimalToFixed8(amount);
      const feeInt = RELAYER_FEE_FIXED8;
      const feeBigInt = BigInt(feeInt);
      const noteAmountBigInt = BigInt(noteAmountInt);
      const amountWithdrawBigInt = BigInt(amountInt);
      if (amountWithdrawBigInt <= feeBigInt) {
        throw new Error("Withdraw amount must be greater than fee.");
      }
      if (amountWithdrawBigInt + feeBigInt > noteAmountBigInt) {
        throw new Error("Withdraw amount plus fee exceeds note amount.");
      }
      const amountChangeBigInt = noteAmountBigInt - amountWithdrawBigInt - feeBigInt;
      const recipientInt = BigInt(`0x${recipientScriptHash}`).toString();
      const relayerInt = BigInt(`0x${relayerScriptHash}`).toString();
      const noteArtifacts = await deriveNoteArtifacts(secretHex, nullifierPrivHex, noteAmountInt, assetScriptHash);
      const newNullifierHex = randomHex(31);
      const newSecretHex = randomHex(31);
      const newNullifierBigInt = BigInt(`0x${newNullifierHex}`);
      const newSecretBigInt = BigInt(`0x${newSecretHex}`);
      const newCommitmentField = poseidon4Bls([
        newNullifierBigInt,
        newSecretBigInt,
        amountChangeBigInt,
        BigInt(`0x${assetScriptHash}`),
      ]);
      const newCommitmentDecimal = newCommitmentField.toString();
      const newCommitmentHex = newCommitmentField.toString(16).padStart(64, "0");

      currentStep = "fetch_merkle";
      setWithdrawActiveStep(currentStep);
      setWithdrawStatusHint("Checking commitment finalization and building Merkle proof...");
      let merkleProof: MerkleProofResponse | null = null;
      const merkleFetchStartedAt = Date.now();
      while (!merkleProof) {
        try {
          merkleProof = await fetchMerkleProofFromRelay(noteArtifacts.commitmentHex);
          setWithdrawStatusHint("");
        } catch (error: unknown) {
          const message = getErrorMessage(error, "Failed to fetch Merkle proof from relay");
          const retryDecision = getMerkleProofRetryDecision(message, Date.now() - merkleFetchStartedAt);
          if (!retryDecision.retry || typeof retryDecision.delayMs !== "number") {
            if (retryDecision.errorMessage) {
              throw new Error(retryDecision.errorMessage);
            }
            throw error;
          }
          setWithdrawStatusHint(
            getMerkleProofRetryStatus(message, retryDecision.delayMs, Date.now() - merkleFetchStartedAt),
          );
          await sleep(retryDecision.delayMs);
        }
      }
      if (!merkleProof) {
        throw new Error("Failed to fetch Merkle proof from relay");
      }
      const merkleRootHex = merkleProof.root;

      currentStep = "generate_proof";
      setWithdrawActiveStep(currentStep);
      setWithdrawStatusHint("Generating zero-knowledge proof locally in your browser. Keep this tab open.");

      const input = {
        root: merkleProof.rootDecimal,
        nullifierHash: noteArtifacts.nullifierHashDecimal,
        recipient: recipientInt,
        relayer: relayerInt,
        fee: feeInt,
        asset: noteArtifacts.assetDecimal,
        amountWithdraw: amountInt,
        newCommitment: newCommitmentDecimal,
        nullifier: BigInt(`0x${nullifierPrivHex.trim().toLowerCase()}`).toString(),
        secret: BigInt(`0x${secretHex.trim().toLowerCase()}`).toString(),
        amountIn: noteAmountInt,
        newNullifier: newNullifierBigInt.toString(),
        newSecret: newSecretBigInt.toString(),
        amountChange: amountChangeBigInt.toString(),
        pathElements: merkleProof.pathElements,
        pathIndices: merkleProof.pathIndices,
      };

      const snarkjs = (await import("snarkjs")) as unknown as {
        groth16: {
          fullProve: (
            witnessInput: Record<string, unknown>,
            wasmPath: string,
            zkeyPath: string,
          ) => Promise<{ proof: Groth16ProofLike; publicSignals: string[] }>;
        };
      };

      const result = await snarkjs.groth16.fullProve(
        input,
        withBasePath("/zk/withdraw.wasm"),
        withBasePath("/zk/withdraw_final.zkey"),
      );
      const proof = result.proof;
      const publicInputs = result.publicSignals;

      currentStep = "submit_to_relayer";
      setWithdrawActiveStep(currentStep);
      setWithdrawStatusHint("Proof generated. Submitting to relayer and waiting for on-chain transaction.");

      const requestBody: Record<string, unknown> = {
        tokenHash: assetScriptHash,
        proof,
        publicInputs,
        merkleRoot: merkleRootHex,
        nullifierHash: noteArtifacts.nullifierHashHex,
        commitment: noteArtifacts.commitmentHex,
        newCommitment: newCommitmentHex,
        recipient,
        relayer,
        amount: amountInt,
        fee: feeInt,
      };

      const res = await fetch("/api/relay", {
        method: "POST",
        headers: buildRelayHeaders(true),
        body: JSON.stringify(requestBody),
      });

      const data = (await res.json()) as { success?: boolean; txid?: string; error?: string };
      if (!res.ok || !data.success || !data.txid) {
        throw new Error(data.error || "Relay failed");
      }

      setTxHash(data.txid);
      setSecretHex("");
      setNullifierPrivHex("");
      setTicketAmount("");
      setTicketAsset("");
      setTicketInput("");
      if (account?.address) {
        localStorage.removeItem(getTicketStorageKey(account.address));
        localStorage.removeItem(getTicketPendingStorageKey(account.address));
      }
      setWithdrawCompleted(true);
      setWithdrawFailedStep(null);
      setWithdrawFailureHint("");
      setWithdrawStatusHint("");
    } catch (err: unknown) {
      const baseMessage = getErrorMessage(err, "Withdraw failed");
      const failureCopy = getWithdrawFailureCopy(currentStep, baseMessage);
      setWithdrawFailedStep(currentStep);
      setWithdrawFailureHint(failureCopy.hint);
      setWithdrawStatusHint("");
      setError(failureCopy.message);
    } finally {
      setWithdrawActiveStep(null);
      setLoading(false);
    }
  };

  const generateRandomParams = async () => {
    try {
      const sec = randomHex(31);
      const nul = randomHex(31);
      const normalizedToken = tokenHash.trim().toLowerCase();
      setSecretHex(sec);
      setNullifierPrivHex(nul);
      setTicketAmount(amount);
      setTicketAsset(normalizedToken);
      const generatedTicket = formatPrivacyTicket({
        secretHex: sec,
        nullifierHex: nul,
        amount,
        tokenHash: normalizedToken,
      });
      setTicketInput(generatedTicket);
      if (account?.address) {
        localStorage.setItem(getTicketStorageKey(account.address), generatedTicket);
        localStorage.setItem(getTicketPendingStorageKey(account.address), "true");
      }

      if (!stealthAddress && account) {
        setStealthAddress(account.address);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to generate random privacy parameters"));
    }
  };

  const ticketDisplay = getTicketString() || ticketInput;

  return (
    <main className="container mx-auto max-w-7xl px-4 py-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center space-x-2">
            <Shield className="h-8 w-8 text-green-400" />
            <h1 className="bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-2xl font-bold text-transparent">
              zNEP-17 Vault
            </h1>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-400">
            <span className="rounded border border-gray-700 bg-gray-900 px-2 py-1">Mode: {proofMode}</span>
            {networkMagic !== null && (
              <span className="rounded border border-gray-700 bg-gray-900 px-2 py-1">
                Network Magic: {networkMagic}
              </span>
            )}


          {/* Advanced Settings Accordion */}
          <div className="mt-8 border-t border-gray-800 pt-4">
            <button 
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
            </button>
            
            {showAdvanced && (
              <div className="mt-4 space-y-4 rounded-lg bg-gray-900/50 p-4 border border-gray-800">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-500">Vault Contract Hash</label>
                    <input
                      type="text"
                      value={vaultHash}
                      onChange={(e) => {
                        if (ALLOW_CUSTOM_VAULT_HASH) setVaultHash(e.target.value);
                      }}
                      readOnly={!ALLOW_CUSTOM_VAULT_HASH}
                      className={`w-full rounded-lg border border-gray-700 px-3 py-2 text-sm text-white ${
                        ALLOW_CUSTOM_VAULT_HASH ? "bg-gray-800" : "cursor-not-allowed bg-gray-800/60 text-gray-400"
                      }`}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-500">Relayer Address</label>
                    <input
                      type="text"
                      value={relayer}
                      readOnly
                      className="w-full cursor-not-allowed rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label className="mb-1 block text-sm font-medium text-gray-500">Manual Privacy Ticket</label>
                    <input
                      type="password"
                      value={ticketInput}
                      onChange={(e) => handleTicketInput(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
                      placeholder="Paste your znep17-... ticket here"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

            {currentRootHex && (
              <span className="rounded border border-blue-700/60 bg-blue-950/40 px-2 py-1 font-mono">
                Root: 0x{currentRootHex.slice(0, 10)}...
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              await loadRelayConfig();
            }}
            disabled={relayLoading}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-300 transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Refresh Relay
            </span>
          </button>
          <button
            onClick={connectWallet}
            className="flex items-center space-x-2 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 transition-colors hover:bg-gray-700"
          >
            <Wallet className="h-4 w-4" />
            <span>{account ? `${account.address.slice(0, 4)}...${account.address.slice(-4)}` : "Connect Wallet"}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-red-500 bg-red-500/10 px-4 py-3 text-red-400">
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {relayIssues.length > 0 && (
        <div className="mb-6 rounded-lg border border-amber-700/60 bg-amber-950/30 px-4 py-3 text-amber-200">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Service setup is still in progress. Retrying automatically every 30 seconds.</p>
            <button
              onClick={async () => {
                await loadRelayConfig();
              }}
              disabled={relayLoading}
              className="rounded border border-amber-600/60 bg-amber-900/30 px-3 py-1 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-900/50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {relayLoading ? "Checking..." : "Check Now"}
            </button>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-100/90">
            {relayIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}

      {txHash && (
        <div className="mb-6 rounded-lg border border-green-500 bg-green-500/10 px-4 py-3 text-green-400">
          Transaction Sent:{" "}
          <a
            href={buildExplorerTxUrl(txHash, networkMagic)}
            target="_blank"
            rel="noreferrer"
            className="break-all underline"
          >
            {txHash}
          </a>
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-8 xl:order-1">
          {/* Asset and Amount Selection */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl">
            <div className="flex flex-col md:flex-row gap-4 mb-2">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-400 mb-2">Select Asset</label>
                <div className="flex gap-4">
                  <button
                    onClick={() => setTokenHash(TOKEN_GAS)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${tokenHash === TOKEN_GAS ? "border-green-500 bg-green-500/10 text-green-400" : "border-gray-700 hover:border-gray-600 bg-gray-800 text-gray-400"}`}
                  >
                    <img
                      src="/tokens/gas.svg"
                      alt="GAS logo"
                      className="h-6 w-6"
                    />
                    <span className="font-semibold tracking-wide">GAS</span>
                  </button>
                  <button
                    onClick={() => setTokenHash(TOKEN_NEO)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${tokenHash === TOKEN_NEO ? "border-green-500 bg-green-500/10 text-green-400" : "border-gray-700 hover:border-gray-600 bg-gray-800 text-gray-400"}`}
                  >
                    <img
                      src="/tokens/neo.svg"
                      alt="NEO logo"
                      className="h-6 w-6"
                    />
                    <span className="font-semibold tracking-wide">NEO</span>
                  </button>
                </div>
              </div>
              <div className="w-full md:w-1/3">
                <label className="block text-sm font-medium text-gray-400 mb-2">Amount</label>
                <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border-2 border-gray-700 bg-gray-900 px-4 py-3 text-white font-mono text-lg h-[52px] focus:border-green-500 focus:outline-none transition-colors" placeholder="0.0" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Deposit Card */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl flex flex-col h-full">
            <h2 className="text-xl font-bold text-green-400 mb-6 flex items-center gap-2">
              <ArrowRight className="h-5 w-5" /> Deposit
            </h2>
            <div className="flex-grow space-y-4">
              <div className="mb-4">
                <input
                  type="text"
                  value={stealthAddress}
                  onChange={(e) => setStealthAddress(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-white"
                  placeholder="Destination (Optional Stealth Address)"
                />
              </div>

              <button
                onClick={generateRandomParams}
                className="mb-4 w-full rounded-lg border border-green-500/30 bg-green-500/10 py-3 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/20"
              >
                {secretHex && nullifierPrivHex ? "Refresh Privacy Ticket" : "Generate Privacy Ticket (Required)"}
              </button>

              {secretHex && (
                <div className="mb-4 rounded-lg border border-yellow-700/50 bg-yellow-900/30 p-4 text-yellow-500">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-yellow-400">Your Privacy Ticket</h3>
                    <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">AUTO-SAVED IN BROWSER</span>
                  </div>
                  <p className="mb-4 text-xs text-yellow-600/80">
                    Critical: this Privacy Ticket is the only way to withdraw. Anyone with it can spend the note.
                    Back it up offline now. If you lose it, funds cannot be recovered.
                  </p>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between rounded bg-black/20 p-3 border border-yellow-700/50">
                      <div className="truncate pr-4 text-yellow-200 tracking-wider">
                        {ticketDisplay}
                      </div>
                      <button 
                        onClick={() => handleCopy(ticketDisplay, "ticket")} 
                        className="flex items-center gap-1 bg-yellow-600/20 hover:bg-yellow-600/40 text-yellow-400 px-3 py-1.5 rounded transition-colors shrink-0"
                      >
                        {copiedKey === "ticket" ? (
                           <><Check className="h-4 w-4" /> Copied!</>
                        ) : (
                           <><Copy className="h-4 w-4" /> Copy Ticket</>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={handleDeposit}
              disabled={loading || !account || !secretHex}
              className="mt-6 flex w-full items-center justify-center space-x-2 rounded-lg bg-green-600 py-4 font-bold text-white transition-colors hover:bg-green-500 focus:ring-4 focus:ring-green-500/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? <Activity className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
              <span>{account ? (secretHex ? "Deposit Anonymously" : "Generate Ticket First") : "Connect Wallet to Deposit"}</span>
            </button>
          </div>

          {/* Withdraw Card */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-2xl flex flex-col h-full">
            <h2 className="text-xl font-bold text-blue-400 mb-6 flex items-center gap-2">
              <Shield className="h-5 w-5" /> Withdraw
            </h2>
            <div className="flex-grow space-y-4">
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-400">Final Recipient Address</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-white"
                  placeholder="Address to receive funds cleanly"
                />
              </div>

              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium text-gray-400">Privacy Ticket</label>
                <input
                  type="text"
                  value={ticketInput}
                  onChange={(e) => handleTicketInput(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 font-mono text-xs text-white"
                  placeholder="Paste your znep17-... ticket"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Auto-filled from your last deposit when available. You can always paste your own ticket here.
                </p>
                <p className="mt-1 text-xs text-amber-400">
                  Backup this ticket offline and keep it private. Loss or leakage means irreversible fund loss.
                </p>
              </div>
              
              {(!secretHex || !nullifierPrivHex) && (
                 <div className="mb-4 rounded border border-yellow-800/50 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-400">
                    <strong>No valid ticket loaded yet.</strong> Paste a Privacy Ticket above or create one with a new deposit.
                 </div>
              )}
            </div>

            <div className="mt-auto">
              <button
                onClick={handleWithdraw}
                disabled={loading || relayLoading || !relayer || !secretHex}
                className="mt-6 flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 py-4 font-bold text-white transition-colors hover:bg-blue-500 focus:ring-4 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Activity className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
                <span>
                  {relayLoading
                    ? "Loading Relayer..."
                    : loading && withdrawActiveStep
                      ? getWithdrawStepCopy(withdrawActiveStep).label
                      : "Process Withdraw"}
                </span>
              </button>
              {(withdrawActiveStep || withdrawFailedStep || withdrawCompleted) && (
                <div className="mt-3 rounded-lg border border-blue-900/50 bg-blue-950/20 p-3">
                  <p className="mb-2 text-xs text-blue-200/80">
                    Expected normal withdrawal time: <strong>~15-30 seconds</strong> once your deposit is finalized in a Merkle root.
                    {" "}If finalization is delayed, zNEP-17 retries automatically for up to{" "}
                    <strong>{MERKLE_FINALIZATION_MAX_WAIT_MINUTES} minutes</strong>.
                  </p>
                  <p
                    className={`text-sm ${
                      withdrawFailedStep ? "text-red-300" : withdrawCompleted ? "text-green-300" : "text-blue-300"
                    }`}
                  >
                    {withdrawFailedStep
                      ? "Withdrawal paused before completion."
                      : withdrawCompleted
                        ? "Withdrawal submitted successfully."
                        : withdrawActiveStep
                          ? getWithdrawStepCopy(withdrawActiveStep).progress
                          : "Preparing withdrawal..."}
                  </p>
                  {loading && withdrawStatusHint && (
                    <p className="mt-1 rounded border border-blue-900/50 bg-blue-950/30 px-2 py-1 text-xs text-blue-200">
                      {withdrawStatusHint}
                    </p>
                  )}
                  <ol className="mt-2 space-y-1">
                    {WITHDRAW_STEP_SEQUENCE.map((step) => {
                      const visualState = getWithdrawStepVisualState(
                        step,
                        withdrawActiveStep,
                        withdrawFailedStep,
                        withdrawCompleted,
                      );
                      const stateClass =
                        visualState === "done"
                          ? "border-green-700/60 bg-green-950/30 text-green-300"
                          : visualState === "active"
                            ? "border-blue-700/70 bg-blue-950/40 text-blue-300"
                            : visualState === "failed"
                              ? "border-red-700/70 bg-red-950/40 text-red-300"
                              : "border-gray-800 bg-gray-900/60 text-gray-500";
                      const stateLabel =
                        visualState === "done"
                          ? "Done"
                          : visualState === "active"
                            ? "In Progress"
                            : visualState === "failed"
                              ? "Failed"
                              : "Pending";

                      return (
                        <li key={step} className={`flex items-center justify-between rounded border px-2 py-1 text-xs ${stateClass}`}>
                          <span className="flex items-center gap-2">
                            <span>{getWithdrawStepCopy(step).label}</span>
                            <span className="rounded border border-gray-700/80 bg-gray-900/70 px-1.5 py-0.5 text-[10px] text-gray-300">
                              {getWithdrawStepCopy(step).expectedDuration}
                            </span>
                          </span>
                          <span className="font-semibold uppercase tracking-wide">{stateLabel}</span>
                        </li>
                      );
                    })}
                  </ol>
                  {withdrawFailureHint && (
                    <p className="mt-2 rounded border border-red-800/60 bg-red-950/40 px-2 py-2 text-xs text-red-300">
                      {withdrawFailureHint}
                    </p>
                  )}
                  {withdrawFailedStep && !loading && (
                    <button
                      onClick={handleWithdraw}
                      disabled={relayLoading || !relayer || !secretHex}
                      className="mt-3 w-full rounded-lg border border-blue-500/40 bg-blue-600/20 py-2 text-sm font-semibold text-blue-200 transition-colors hover:bg-blue-600/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Retry Withdraw
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        </section>

        {/* Documentation Section */}
        <aside className="xl:order-2 xl:self-start">
          <div className="relative rounded-xl border border-blue-900/50 bg-blue-950/20 p-5 shadow-xl">
            <div className="absolute top-0 left-0 h-full w-2 bg-blue-500"></div>
            <div className="flex items-start gap-4">
              <div className="mt-1 rounded-full bg-blue-500/20 p-1.5 text-blue-400">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="mb-2 text-base font-bold text-gray-100">How zNEP-17 Works</h2>
                <p className="mb-3 text-xs leading-relaxed text-gray-400">
                  zNEP-17 is a Zero-Knowledge privacy vault for the Neo N3 blockchain. It breaks the on-chain link between the sender and the receiver, allowing you to transfer assets anonymously.
                </p>
                <div className="grid grid-cols-1 gap-3 text-xs text-gray-300">
                  <div>
                    <h3 className="mb-1 flex items-center gap-2 font-semibold text-blue-300"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-900 text-[10px] text-white">1</span> Deposit</h3>
                    <p className="leading-relaxed">When you deposit, a random <strong>Secret</strong> and <strong>Nullifier</strong> are generated. These are mathematically hashed into a &quot;Leaf&quot; and inserted into the vault&apos;s on-chain Merkle tree. Your wallet is disconnected from this secret ticket.</p>
                  </div>
                  <div>
                    <h3 className="mb-1 flex items-center gap-2 font-semibold text-green-300"><span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-900 text-[10px] text-white">2</span> Withdraw</h3>
                    <p className="leading-relaxed">To withdraw, your browser generates a <strong>zk-SNARK proof</strong> using your Secret and Nullifier (typically <strong>2-20s</strong>, depending on device). The relayer then submits the transaction (<strong>~10-15s</strong> on testnet). This proves you own a deposit without revealing <i>which</i> deposit it is, and sends funds to a fresh address.</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-blue-900/30 pt-3 sm:flex-row sm:items-center">
                  <div className="text-[11px] text-gray-400">
                    <span className="mb-1 block"><strong className="text-gray-300">Vault Contract:</strong> <code className="ml-1 break-all select-all rounded bg-gray-900 px-1 py-0.5">{vaultHash || process.env.NEXT_PUBLIC_VAULT_HASH || "Loading..."}</code></span>
                    <span className="block"><strong className="text-gray-300">Network:</strong> {networkMagic === 860833102 ? "Mainnet" : "Testnet"} ({networkMagic})</span>
                  </div>
                  <a
                    href="https://github.com/r3e-network/znep17"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded bg-blue-900/30 px-2.5 py-1.5 text-[11px] font-semibold text-blue-400 transition-colors hover:text-blue-300"
                  >
                    <Info className="h-3.5 w-3.5" />
                    View Documentation
                  </a>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      
        {/* Advanced Settings Accordion */}
        <div className="mt-8 border-t border-gray-800 pt-4">
          <button 
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center text-sm font-medium text-gray-500 hover:text-gray-300 transition-colors"
          >
            {showAdvanced ? "Hide Advanced Settings" : "Show Advanced Settings"}
          </button>
          
          {showAdvanced && (
            <div className="mt-4 space-y-4 rounded-lg bg-gray-900/50 p-4 border border-gray-800">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-500">Vault Contract Hash</label>
                  <input
                    type="text"
                    value={vaultHash}
                    onChange={(e) => {
                      if (ALLOW_CUSTOM_VAULT_HASH) setVaultHash(e.target.value);
                    }}
                    readOnly={!ALLOW_CUSTOM_VAULT_HASH}
                    className={`w-full rounded-lg border border-gray-700 px-3 py-2 text-sm text-white ${
                      ALLOW_CUSTOM_VAULT_HASH ? "bg-gray-800" : "cursor-not-allowed bg-gray-800/60 text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-500">Relayer Address</label>
                  <input
                    type="text"
                    value={relayer}
                    readOnly
                    className="w-full cursor-not-allowed rounded-lg border border-gray-700 bg-gray-800/60 px-3 py-2 text-sm text-gray-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-gray-500">Manual Privacy Ticket</label>
                  <input
                    type="password"
                    value={ticketInput}
                    onChange={(e) => handleTicketInput(e.target.value)}
                    className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white focus:border-blue-500 focus:outline-none transition-colors"
                    placeholder="Paste your znep17-... ticket here"
                  />
                </div>
              </div>
            </div>
          )}
        </div>


    </main>
  );
}
