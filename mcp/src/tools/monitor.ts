import { type Address, isAddress } from "viem";
import { getAavePosition, getSparkPosition } from "../data/aave.js";
import { getMorphoPosition } from "../data/morpho.js";
import { getCompoundPosition } from "../data/compound.js";
import type { SupportedChain } from "../data/client.js";
import type { PositionData } from "../data/types.js";
import { SyeniteError } from "../errors.js";

export const monitorToolName = "lending.position.monitor";

export const monitorToolDescription = `Reads the live health of any EVM wallet's lending positions across Aave v3, Morpho Blue, Compound V3, and Spark on Ethereum, Arbitrum, and Base — no authentication required.
Call this before withdrawing collateral or after price moves to verify health factor and liquidation distance; positions with health factor below 1.5 trigger an explicit warning in the response.
Provide the 0x-prefixed EVM \`address\` to inspect; optionally filter by \`protocol\` ("aave-v3", "morpho-blue", "compound-v3", or "spark") and \`chain\` to reduce response size.
Returns per-position: collateral asset and USD value, debt asset and USD value, current LTV, health factor, liquidation price, percentage price drop to liquidation, borrow APY, and estimated annual interest cost; does not execute any transaction.`;

export async function handlePositionMonitor(params: {
  address: string;
  protocol?: string;
  chain?: string;
}): Promise<Record<string, unknown>> {
  if (!isAddress(params.address)) {
    throw SyeniteError.invalidInput(
      `"${params.address}" is not a valid EVM address. Provide a 0x-prefixed 42-character hex address.`
    );
  }

  const address = params.address as Address;
  const protocol = params.protocol?.toLowerCase();
  const chains = params.chain && params.chain !== "all"
    ? [params.chain as SupportedChain]
    : undefined;

  const positionPromises: Promise<PositionData[]>[] = [];

  if (!protocol || protocol === "aave-v3" || protocol === "aave") {
    positionPromises.push(getAavePosition(address, undefined, chains));
  }
  if (!protocol || protocol === "morpho-blue" || protocol === "morpho") {
    positionPromises.push(getMorphoPosition(address));
  }
  if (!protocol || protocol === "spark") {
    positionPromises.push(getSparkPosition(address, undefined, chains));
  }
  if (!protocol || protocol === "compound-v3" || protocol === "compound") {
    positionPromises.push(getCompoundPosition(address, undefined, chains));
  }

  const results = (await Promise.all(positionPromises)).flat();

  const atRisk = results.filter((p) => p.healthFactor < 1.5);

  return {
    address,
    positionCount: results.length,
    ...(atRisk.length > 0 && {
      warning: `${atRisk.length} position(s) have health factor below 1.5 — approaching liquidation risk.`,
    }),
    positions: results.map((p) => ({
      protocol: p.protocol,
      market: p.market,
      collateral: {
        asset: p.collateral.asset,
        amount: round(p.collateral.amount, 6),
        valueUSD: round(p.collateral.valueUSD),
      },
      debt: {
        asset: p.debt.asset,
        amount: round(p.debt.amount),
        valueUSD: round(p.debt.valueUSD),
      },
      currentLTV: round(p.currentLTV),
      healthFactor: p.healthFactor === Infinity ? "safe (no debt)" : round(p.healthFactor),
      liquidationPrice: round(p.liquidationPrice),
      distanceToLiquidationPct: round(p.distanceToLiquidation),
      distanceToLiquidation: `${round(p.distanceToLiquidation)}% price drop needed`,
      borrowRateAPY: round(p.borrowRate),
      estimatedAnnualCost: round(p.estimatedAnnualCost),
    })),
    timestamp: new Date().toISOString(),
  };
}

function round(n: number, decimals = 2): number {
  return Math.round(n * 10 ** decimals) / 10 ** decimals;
}
