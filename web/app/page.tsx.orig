"use client";

import { useCallback, useEffect, useState } from "react";
import { Wallet, ArrowRight, Shield, Activity, X, RefreshCw, Copy, Check } from "lucide-react";
import { wallet } from "@cityofzion/neon-js";
import { poseidon1Bls, poseidon4Bls } from "./lib/blsPoseidon";

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
const RELAYER_FEE_FIXED8 = "100000000";
const HASH160_HEX_RE = /^(?:0x)?[0-9a-fA-F]{40}$/;
const HEX_32_RE = /^[0-9a-fA-F]{64}$/;
const SECRET_RE = /^[0-9a-fA-F]{1,64}$/;
const DECIMAL_RE = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const EXPLORER_TX_BASE_OVERRIDE = sanitizeExplorerTxBaseUrl(process.env.NEXT_PUBLIC_EXPLORER_TX_BASE_URL || "");
const EXPLORER_TX_BASE_BY_NETWORK_MAGIC: Record<number, string> = {
  894710606: "https://testnet.ndora.org/transaction/",
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

function normalizeBasePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return "";
  const normalized = trimmed.replace(/^\/+|\/+$/g, "");
  return normalized ? `/${normalized}` : "";
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
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">("deposit");
  const [amount, setAmount] = useState("10");
  const [tokenHash, setTokenHash] = useState(TOKEN_DEFAULT);
  const [vaultHash, setVaultHash] = useState("");
  const [relayVaultHash, setRelayVaultHash] = useState("");
  const [stealthAddress, setStealthAddress] = useState("");
  const [leafHex, setLeafHex] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");

  const [recipient, setRecipient] = useState("");
  const [relayer, setRelayer] = useState("");
  const [relayLoading, setRelayLoading] = useState(true);
  const [proofMode, setProofMode] = useState<ProofMode>("snark");
  const [networkMagic, setNetworkMagic] = useState<number | null>(null);
  const [currentRootHex, setCurrentRootHex] = useState("");

  const [zkStatus, setZkStatus] = useState("");
  const [secretHex, setSecretHex] = useState("");
  const [nullifierPrivHex, setNullifierPrivHex] = useState("");
  const [copiedKey, setCopiedKey] = useState<"secret" | "nullifier" | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleCopy = async (text: string, type: "secret" | "nullifier") => {
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

      if (!res.ok || !data.configured || !data.relayerAddress || !wallet.isAddress(data.relayerAddress)) {
        const issueSummary = Array.isArray(data.issues) && data.issues.length > 0 ? ` ${data.issues.join(" ")}` : "";
        throw new Error((data.error || "Relayer unavailable.") + issueSummary);
      }
      if (data.requiresApiKey) {
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
    if (!secretHex || !nullifierPrivHex) {
      return;
    }

    let cancelled = false;
    const syncCommitment = async () => {
      try {
        const assetScriptHash = normalizeHash160(tokenHash, "Token script hash");
        const amountInt = decimalToFixed8(amount);
        const noteArtifacts = await deriveNoteArtifacts(secretHex, nullifierPrivHex, amountInt, assetScriptHash);
        if (!cancelled) {
          setLeafHex(noteArtifacts.commitmentHex);
        }
      } catch {
        if (!cancelled) {
          setLeafHex("");
        }
      }
    };

    void syncCommitment();
    return () => {
      cancelled = true;
    };
  }, [amount, nullifierPrivHex, secretHex, tokenHash]);

  useEffect(() => {
    const hasPending = localStorage.getItem("znep17_has_pending");
    if (hasPending === "true") {
       const lsSecret = localStorage.getItem("znep17_last_secret");
       const lsNullifier = localStorage.getItem("znep17_last_nullifier");
       const lsAmount = localStorage.getItem("znep17_last_amount");
       const lsToken = localStorage.getItem("znep17_last_token");
       
       if (lsSecret) setSecretHex(lsSecret);
       if (lsNullifier) setNullifierPrivHex(lsNullifier);
       if (lsAmount) setAmount(lsAmount);
       if (lsToken) setTokenHash(lsToken);
    }
  }, []);

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
      setError(getErrorMessage(err, "Failed to connect wallet"));
    }
  };

  const handleDeposit = async () => {
    if (!account) return setError("Please connect wallet first");
    if (!tokenHash || !vaultHash || !amount || !stealthAddress || !secretHex || !nullifierPrivHex) {
      return setError("Please fill all fields");
    }

    setLoading(true);
    setError("");
    setTxHash("");

    try {
      if (typeof window === "undefined" || !window.NEOLineN3) {
        throw new Error("NeoLine N3 wallet extension is not installed");
      }

      const neoline = new window.NEOLineN3.Init();
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
      const stealthScriptHash = toHash160(stealthAddress, "Stealth address");
      const amountInt = decimalToFixed8(amount);
      const noteArtifacts = await deriveNoteArtifacts(secretHex, nullifierPrivHex, amountInt, assetScriptHash);
      const normalizedLeaf = noteArtifacts.commitmentHex;
      setLeafHex(normalizedLeaf);

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
      setError(getErrorMessage(err, "Deposit failed"));
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!tokenHash || !amount || !recipient || !relayer || !secretHex || !nullifierPrivHex) {
      return setError("Please fill all required fields");
    }
    if (relayLoading) return setError("Relayer configuration is still loading");

    setLoading(true);
    setError("");
    setTxHash("");

    try {
      const assetScriptHash = normalizeHash160(tokenHash, "Token script hash");
      const recipientScriptHash = toHash160(recipient, "Recipient");
      const relayerScriptHash = toHash160(relayer, "Relayer");

      const amountInt = decimalToFixed8(amount);
      const feeInt = RELAYER_FEE_FIXED8;
      const recipientInt = BigInt(`0x${recipientScriptHash}`).toString();
      const relayerInt = BigInt(`0x${relayerScriptHash}`).toString();
      const noteArtifacts = await deriveNoteArtifacts(secretHex, nullifierPrivHex, amountInt, assetScriptHash);

      setZkStatus("Fetching Merkle proof from relay...");
      const merkleProof = await fetchMerkleProofFromRelay(noteArtifacts.commitmentHex);
      const merkleRootHex = merkleProof.root;

      setZkStatus("Generating Groth16 proof...");

      const input = {
        root: merkleProof.rootDecimal,
        nullifierHash: noteArtifacts.nullifierHashDecimal,
        recipient: recipientInt,
        relayer: relayerInt,
        amount: amountInt,
        fee: feeInt,
        asset: noteArtifacts.assetDecimal,
        commitment: noteArtifacts.commitmentDecimal,
        nullifier: BigInt(`0x${nullifierPrivHex.trim().toLowerCase()}`).toString(),
        secret: BigInt(`0x${secretHex.trim().toLowerCase()}`).toString(),
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

      setZkStatus("Submitting withdrawal proof to relayer...");

      const requestBody: Record<string, unknown> = {
        tokenHash: assetScriptHash,
        proof,
        publicInputs,
        merkleRoot: merkleRootHex,
        nullifierHash: noteArtifacts.nullifierHashHex,
        commitment: noteArtifacts.commitmentHex,
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
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Withdraw failed"));
    } finally {
      setLoading(false);
      setZkStatus("");
    }
  };

  const generateRandomParams = async () => {
    try {
      const sec = randomHex(31);
      const nul = randomHex(31);
      setSecretHex(sec);
      setNullifierPrivHex(nul);

      const assetScriptHash = normalizeHash160(tokenHash, "Token script hash");
      const amountInt = decimalToFixed8(amount);
      const noteArtifacts = await deriveNoteArtifacts(sec, nul, amountInt, assetScriptHash);
      setLeafHex(noteArtifacts.commitmentHex);
      localStorage.setItem("znep17_last_secret", sec);
      localStorage.setItem("znep17_last_nullifier", nul);
      localStorage.setItem("znep17_last_amount", amount);
      localStorage.setItem("znep17_last_token", tokenHash);
      localStorage.setItem("znep17_has_pending", "true");

      if (!stealthAddress && account) {
        setStealthAddress(account.address);
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Failed to generate random privacy parameters"));
    }
  };

  return (
    <main className="container mx-auto max-w-4xl px-4 py-8">
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
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-500">Manual Secret (Hex)</label>
                    <input
                      type="password"
                      value={secretHex}
                      onChange={(e) => setSecretHex(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white"
                      placeholder="Override stored secret"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-500">Manual Nullifier (Hex)</label>
                    <input
                      type="password"
                      value={nullifierPrivHex}
                      onChange={(e) => setNullifierPrivHex(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 font-mono text-sm text-white"
                      placeholder="Override stored nullifier"
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

      <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800 shadow-2xl">
        <div className="flex border-b border-gray-700">
          <button
            className={`flex-1 py-4 text-center font-medium transition-colors ${
              activeTab === "deposit" ? "bg-gray-700 text-green-400" : "text-gray-400 hover:bg-gray-700"
            }`}
            onClick={() => setActiveTab("deposit")}
          >
            Deposit
          </button>
          <button
            className={`flex-1 py-4 text-center font-medium transition-colors ${
              activeTab === "withdraw" ? "bg-gray-700 text-blue-400" : "text-gray-400 hover:bg-gray-700"
            }`}
            onClick={() => setActiveTab("withdraw")}
          >
            Withdraw
          </button>
        </div>

        <div className="space-y-4 p-6">
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-400 mb-2">Select Asset</label>
              <div className="flex gap-4">
                <button
                  onClick={() => setTokenHash("0xd2a4cff31913016155e38e474a2c06d08be276cf")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${tokenHash === "0xd2a4cff31913016155e38e474a2c06d08be276cf" ? "border-green-500 bg-green-500/10 text-green-400" : "border-gray-700 hover:border-gray-600 bg-gray-800 text-gray-400"}`}
                >
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center font-bold text-green-400 text-xs">G</div>
                  <span className="font-semibold tracking-wide">GAS</span>
                </button>
                <button
                  onClick={() => setTokenHash("0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5")}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 transition-all ${tokenHash === "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5" ? "border-green-500 bg-green-500/10 text-green-400" : "border-gray-700 hover:border-gray-600 bg-gray-800 text-gray-400"}`}
                >
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center font-bold text-green-400 text-xs">N</div>
                  <span className="font-semibold tracking-wide">NEO</span>
                </button>
              </div>
            </div>
            <div className="w-full md:w-1/3">
              <label className="block text-sm font-medium text-gray-400 mb-2">Amount</label>
              <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full rounded-xl border-2 border-gray-700 bg-gray-900 px-4 py-3 text-white font-mono text-lg h-[52px] focus:border-green-500 focus:outline-none transition-colors" placeholder="0.0" />
            </div>
          </div>

          {activeTab === "deposit" ? (
            <>
              <div className="mb-4">
                <input
                  type="text"
                  value={stealthAddress}
                  onChange={(e) => setStealthAddress(e.target.value)}
                  className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-white"
                  placeholder="Destination (Optional Stealth Address)"
                />
              </div>

              {(!secretHex || !nullifierPrivHex) && (
                 <button
                   onClick={generateRandomParams}
                   className="mb-4 w-full rounded-lg border border-green-500/30 bg-green-500/10 py-3 text-sm font-medium text-green-400 transition-colors hover:bg-green-500/20"
                 >
                   Generate Privacy Ticket (Required)
                 </button>
              )}

              {secretHex && (
                <div className="mb-4 rounded-lg border border-yellow-700/50 bg-yellow-900/30 p-4 text-yellow-500">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="font-semibold text-yellow-400">Your Privacy Ticket</h3>
                    <span className="rounded bg-yellow-500/20 px-2 py-0.5 text-[10px] font-bold text-yellow-300">AUTO-SAVED IN BROWSER</span>
                  </div>
                  <p className="mb-4 text-xs text-yellow-600/80">
                    For maximum security, copy these values. You will need them to withdraw if you clear your browser cache.
                  </p>
                  <div className="space-y-2 font-mono text-xs">
                    <div className="flex items-center justify-between rounded bg-black/20 p-2">
                      <div className="truncate pr-2"><span className="select-none text-yellow-700">Secret:</span> {secretHex}</div>
                      <button onClick={() => handleCopy(secretHex, "secret")} className="hover:text-yellow-300">
                        {copiedKey === "secret" ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                    <div className="flex items-center justify-between rounded bg-black/20 p-2">
                      <div className="truncate pr-2"><span className="select-none text-yellow-700">Nullifier:</span> {nullifierPrivHex}</div>
                      <button onClick={() => handleCopy(nullifierPrivHex, "nullifier")} className="hover:text-yellow-300">
                        {copiedKey === "nullifier" ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                onClick={handleDeposit}
                disabled={loading || !account || !secretHex}
                className="mt-2 flex w-full items-center justify-center space-x-2 rounded-lg bg-green-600 py-4 font-bold text-white transition-colors hover:bg-green-500 focus:ring-4 focus:ring-green-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Activity className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5" />}
                <span>{account ? (secretHex ? "Deposit Anonymously" : "Generate Ticket First") : "Connect Wallet to Deposit"}</span>
              </button>
            </>
          ) : (
            <>
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
              
              {(!secretHex || !nullifierPrivHex) && (
                 <div className="mb-4 rounded border border-yellow-800/50 bg-yellow-950/30 px-4 py-3 text-sm text-yellow-400">
                    <strong>No auto-saved ticket found.</strong> Please open Advanced Settings to enter your Secret and Nullifier manually.
                 </div>
              )}

              <button
                onClick={handleWithdraw}
                disabled={loading || relayLoading || !relayer || !secretHex}
                className="mt-4 flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-600 py-4 font-bold text-white transition-colors hover:bg-blue-500 focus:ring-4 focus:ring-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? <Activity className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
                <span>{relayLoading ? "Loading Relayer..." : "Process Withdraw"}</span>
              </button>
              {zkStatus && <p className="mt-2 animate-pulse text-center text-sm text-blue-400">{zkStatus}</p>}
            </>
          )}
        </div>
      </div>


      </main>
  );
}
