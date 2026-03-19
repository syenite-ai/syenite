import { type Address } from "viem";
import { getClient, type SupportedChain } from "../data/client.js";
import { CHAIN_IDS, CHAIN_NAMES } from "../data/types.js";
import { lookupContract, type ProtocolContract } from "../data/contracts.js";
import { SyeniteError } from "../errors.js";
import { log } from "../logging/logger.js";

export const txVerifyDescription = `Verify that a transaction targets a known, verified contract — not an arbitrary address.
Cross-references against Etherscan (verified source code), Sourcify (independent verification), and Syenite's curated protocol registry.
Use this to confirm a contract's identity before signing any transaction. Works for any transaction, not just Syenite's.`;

const FOUR_BYTE_URL = "https://www.4byte.directory/api/v1/signatures/";

interface EtherscanVerification {
  verified: boolean;
  contractName: string | null;
  compiler: string | null;
  proxy: boolean;
  implementation: string | null;
}

interface SourcifyVerification {
  verified: boolean;
  match: "full" | "partial" | "none";
}

function resolveChain(chainInput: string | number): { name: SupportedChain; id: number } {
  if (typeof chainInput === "number") {
    const name = CHAIN_NAMES[chainInput];
    if (name && ["ethereum", "arbitrum", "base", "bsc"].includes(name)) {
      return { name: name as SupportedChain, id: chainInput };
    }
    throw SyeniteError.invalidInput(`Unsupported chainId: ${chainInput}`);
  }
  const lower = chainInput.toLowerCase();
  const id = CHAIN_IDS[lower];
  if (id && ["ethereum", "arbitrum", "base", "bsc"].includes(lower)) {
    return { name: lower as SupportedChain, id };
  }
  throw SyeniteError.invalidInput(`Unsupported chain: ${chainInput}`);
}

async function checkEtherscan(address: string, chainId: number): Promise<EtherscanVerification> {
  try {
    const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=contract&action=getsourcecode&address=${address}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const data = await resp.json();

    if (data.status === "1" && data.result?.[0]) {
      const r = data.result[0];
      const verified = r.SourceCode !== "" && r.SourceCode !== undefined;
      return {
        verified,
        contractName: verified ? r.ContractName : null,
        compiler: verified ? r.CompilerVersion : null,
        proxy: r.Proxy === "1",
        implementation: r.Implementation || null,
      };
    }
    return { verified: false, contractName: null, compiler: null, proxy: false, implementation: null };
  } catch (e) {
    log.warn("Etherscan lookup failed", { error: (e as Error).message, address, chainId });
    return { verified: false, contractName: null, compiler: null, proxy: false, implementation: null };
  }
}

async function checkSourcify(address: string, chainId: number): Promise<SourcifyVerification> {
  try {
    const url = `https://sourcify.dev/server/check-all-by-addresses?addresses=${address}&chainIds=${chainId}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const data = await resp.json();

    if (Array.isArray(data) && data[0]?.chainIds) {
      const chain = data[0].chainIds.find((c: Record<string, unknown>) => String(c.chainId) === String(chainId));
      if (chain?.status) {
        return {
          verified: true,
          match: chain.status === "perfect" ? "full" : "partial",
        };
      }
    }
    return { verified: false, match: "none" };
  } catch (e) {
    log.warn("Sourcify lookup failed", { error: (e as Error).message, address, chainId });
    return { verified: false, match: "none" };
  }
}

async function decodeFunctionSelector(data: string): Promise<{ selector: string; name: string | null }> {
  if (!data || data.length < 10) return { selector: "0x", name: null };

  const selector = data.slice(0, 10);
  try {
    const url = `${FOUR_BYTE_URL}?hex_signature=${selector}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    const result = await resp.json();
    if (result.results?.length > 0) {
      return { selector, name: result.results[0].text_signature };
    }
  } catch {
    // 4byte.directory is best-effort
  }
  return { selector, name: null };
}

function generateRiskFlags(
  etherscan: EtherscanVerification,
  sourcify: SourcifyVerification,
  known: ProtocolContract | null,
  isContract: boolean,
): string[] {
  const flags: string[] = [];

  if (!isContract) {
    flags.push("eoa_target");
    return flags;
  }

  if (!etherscan.verified && !sourcify.verified) {
    flags.push("unverified_contract");
  }

  if (!known) {
    flags.push("unknown_protocol");
  }

  if (etherscan.proxy) {
    flags.push("proxy_contract");
  }

  return flags;
}

export async function handleTxVerify(params: {
  to: string;
  chain: string;
  data?: string;
}): Promise<Record<string, unknown>> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(params.to)) {
    throw SyeniteError.invalidInput("Invalid address format");
  }

  const chain = resolveChain(params.chain);
  const client = getClient(chain.name);
  const address = params.to as Address;

  // Check if it's a contract (has code)
  const code = await client.getCode({ address });
  const isContract = !!code && code !== "0x";

  // Parallel lookups
  const [etherscan, sourcify, functionInfo] = await Promise.all([
    checkEtherscan(params.to, chain.id),
    checkSourcify(params.to, chain.id),
    params.data ? decodeFunctionSelector(params.data) : Promise.resolve({ selector: "N/A", name: null }),
  ]);

  const known = lookupContract(chain.id, params.to);
  const riskFlags = generateRiskFlags(etherscan, sourcify, known, isContract);

  const protocol = known
    ? {
        identified: true,
        name: known.protocol,
        contractName: known.name,
        type: known.type,
        syeniteAllowlisted: true,
        risk: known.risk,
      }
    : {
        identified: false,
        name: null,
        contractName: etherscan.contractName,
        type: null,
        syeniteAllowlisted: false,
        risk: null,
      };

  const parts: string[] = [];
  if (known) parts.push(`Known ${known.protocol} contract (${known.name})`);
  else if (etherscan.verified) parts.push(`Verified contract: ${etherscan.contractName}`);
  else if (isContract) parts.push("Unverified contract");
  else parts.push("EOA (not a contract)");
  parts.push(`on ${chain.name}`);
  if (etherscan.verified) parts.push("| Etherscan verified");
  if (sourcify.verified) parts.push(`| Sourcify ${sourcify.match} match`);
  if (riskFlags.length > 0) parts.push(`| Flags: ${riskFlags.join(", ")}`);

  return {
    address: params.to,
    chain: chain.name,
    isContract,
    verification: {
      etherscan,
      sourcify,
    },
    protocol,
    functionCalled: params.data
      ? {
          selector: functionInfo.selector,
          name: functionInfo.name,
          decoded: functionInfo.name !== null,
        }
      : null,
    riskFlags,
    riskFlagCount: riskFlags.length,
    summary: parts.join(" "),
    timestamp: new Date().toISOString(),
    note: "Verification uses Etherscan, Sourcify, and Syenite's curated protocol registry. Etherscan and Sourcify are independent third parties. — syenite.ai",
  };
}
