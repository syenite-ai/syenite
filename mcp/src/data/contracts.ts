import type { Address } from "viem";

export interface ProtocolContract {
  name: string;
  protocol: string;
  type: "lending" | "aggregator" | "bridge" | "dex" | "vault" | "staking" | "oracle" | "registry" | "other";
  risk: "low" | "medium" | "high";
}

type Registry = Record<number, Record<string, ProtocolContract>>;

const KNOWN: Registry = {
  // Ethereum (1)
  1: {
    "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2": { name: "Aave V3 Pool", protocol: "Aave", type: "lending", risk: "low" },
    "0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb": { name: "Morpho Blue", protocol: "Morpho", type: "lending", risk: "low" },
    "0xC13e21B648A5Ee794902342038FF3aDAB66BE987": { name: "Spark Pool", protocol: "Spark", type: "lending", risk: "low" },
    "0xc3d688B66703497DAA19211EEdff47f25384cdc3": { name: "Compound V3 USDC", protocol: "Compound", type: "lending", risk: "low" },
    "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE": { name: "Li.Fi Diamond", protocol: "Li.Fi", type: "aggregator", risk: "low" },
    "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84": { name: "Lido stETH", protocol: "Lido", type: "staking", risk: "low" },
    "0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0": { name: "Lido wstETH", protocol: "Lido", type: "staking", risk: "low" },
    "0x83F20F44975D03b1b09e64809B757c47f942BEeA": { name: "Maker sDAI", protocol: "Maker", type: "vault", risk: "low" },
    "0x9D39A5DE30e57443BfF2A8307A4256c8797A3497": { name: "Ethena sUSDe", protocol: "Ethena", type: "vault", risk: "medium" },
  },
  // Arbitrum (42161)
  42161: {
    "0x794a61358D6845594F94dc1DB02A252b5b4814aD": { name: "Aave V3 Pool", protocol: "Aave", type: "lending", risk: "low" },
    "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE": { name: "Li.Fi Diamond", protocol: "Li.Fi", type: "aggregator", risk: "low" },
    "0xA5EDBDD9646f8dFF606d7448e414884C7d905dCA": { name: "Compound V3 USDC.e", protocol: "Compound", type: "lending", risk: "low" },
  },
  // Base (8453)
  8453: {
    "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5": { name: "Aave V3 Pool", protocol: "Aave", type: "lending", risk: "low" },
    "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE": { name: "Li.Fi Diamond", protocol: "Li.Fi", type: "aggregator", risk: "low" },
    "0xb125E6687d4313864e53df431d5425969c15Eb2F": { name: "Compound V3 USDC", protocol: "Compound", type: "lending", risk: "low" },
  },
  // BNB (56)
  56: {
    "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE": { name: "Li.Fi Diamond", protocol: "Li.Fi", type: "aggregator", risk: "low" },
    "0xfD36E2c2a6789Db23113685031d7F16329158384": { name: "Venus Comptroller", protocol: "Venus", type: "lending", risk: "low" },
  },
};

export function lookupContract(chainId: number, address: string): ProtocolContract | null {
  const chain = KNOWN[chainId];
  if (!chain) return null;
  const checksummed = Object.keys(chain).find(
    (k) => k.toLowerCase() === address.toLowerCase()
  );
  return checksummed ? chain[checksummed] : null;
}

export function getDefaultAllowlist(chainId: number): string[] {
  return Object.keys(KNOWN[chainId] ?? {});
}

export function getAllKnownContracts(): Registry {
  return KNOWN;
}
