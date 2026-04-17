import { Connection, PublicKey, type AccountInfo, type Commitment } from "@solana/web3.js";
import { log } from "../../logging/logger.js";

const DEFAULT_RPC = "https://api.mainnet-beta.solana.com";
const DEFAULT_COMMITMENT: Commitment = "confirmed";

let cachedConnection: Connection | null = null;

function getRpcUrl(): string {
  const envUrl = process.env.SOLANA_RPC_URL;
  if (envUrl && envUrl.trim().length > 0) return envUrl.trim();
  return DEFAULT_RPC;
}

export function getSolanaConnection(): Connection {
  if (cachedConnection) return cachedConnection;
  cachedConnection = new Connection(getRpcUrl(), {
    commitment: DEFAULT_COMMITMENT,
    confirmTransactionInitialTimeout: 15_000,
  });
  return cachedConnection;
}

export function resetSolanaConnection(): void {
  cachedConnection = null;
}

export function isSolanaAddress(address: string): boolean {
  if (!address) return false;
  if (address.startsWith("0x")) return false;
  if (address.length < 32 || address.length > 44) return false;
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export async function getAccountInfo(
  pubkey: string | PublicKey,
): Promise<AccountInfo<Buffer> | null> {
  const key = typeof pubkey === "string" ? new PublicKey(pubkey) : pubkey;
  const conn = getSolanaConnection();
  try {
    return await conn.getAccountInfo(key, DEFAULT_COMMITMENT);
  } catch (e) {
    log.warn("Solana getAccountInfo failed", {
      pubkey: key.toBase58(),
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

export async function getRecentPrioritizationFees(): Promise<number[]> {
  const conn = getSolanaConnection();
  try {
    const fees = await conn.getRecentPrioritizationFees();
    return fees.map((f) => f.prioritizationFee);
  } catch (e) {
    log.warn("Solana getRecentPrioritizationFees failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return [];
  }
}
