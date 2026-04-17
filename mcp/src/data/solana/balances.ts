import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getSolanaConnection } from "./client.js";
import { resolveMint } from "./tokens.js";
import { log } from "../../logging/logger.js";

export interface SolanaBalance {
  chain: "solana";
  native: { symbol: "SOL"; balance: string; balanceRaw: string };
  tokens: Array<{ symbol: string; balance: string; balanceRaw: string; mint: string }>;
}

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

export async function fetchSolanaBalances(owner: string): Promise<SolanaBalance> {
  const ownerKey = new PublicKey(owner);
  const conn = getSolanaConnection();

  const lamports = await conn.getBalance(ownerKey).catch((e) => {
    log.warn("Solana getBalance failed", {
      owner,
      error: e instanceof Error ? e.message : String(e),
    });
    return 0;
  });

  const native = {
    symbol: "SOL" as const,
    balance: (lamports / LAMPORTS_PER_SOL).toFixed(9).replace(/0+$/, "").replace(/\.$/, ""),
    balanceRaw: lamports.toString(),
  };

  const tokens: SolanaBalance["tokens"] = [];
  for (const programId of [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]) {
    try {
      const resp = await conn.getParsedTokenAccountsByOwner(ownerKey, { programId });
      for (const { account } of resp.value) {
        const info = account.data.parsed?.info;
        const amount = info?.tokenAmount;
        if (!info || !amount) continue;
        const raw: string = amount.amount ?? "0";
        if (raw === "0") continue;
        const mint: string = info.mint ?? "";
        const decimals: number = amount.decimals ?? 0;
        const known = resolveMint(mint);
        const symbol = known?.symbol ?? mint.slice(0, 4);
        const formatted = amount.uiAmountString ?? (Number(raw) / 10 ** decimals).toString();
        tokens.push({ symbol, balance: formatted, balanceRaw: raw, mint });
      }
    } catch (e) {
      log.warn("Solana getParsedTokenAccountsByOwner failed", {
        owner,
        program: programId.toBase58(),
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return { chain: "solana", native, tokens };
}
