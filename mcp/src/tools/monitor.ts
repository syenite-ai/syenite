import { type Address, isAddress } from "viem";
import { getAavePosition, getSparkPosition } from "../data/aave.js";
import { getMorphoPosition } from "../data/morpho.js";
import type { PositionData } from "../data/types.js";
import { SyeniteError } from "../errors.js";

export const monitorToolName = "lending.position.monitor";

export const monitorToolDescription = `Check the health of any DeFi lending position on Aave v3, Morpho Blue, or Spark (Ethereum mainnet).
Returns current LTV, health factor, liquidation price, distance to liquidation (% price drop needed), borrow rate, and estimated annual cost.
Works with any wallet address. Scans all collateral types (BTC wrappers, ETH, LSTs) automatically.`;

export async function handlePositionMonitor(params: {
  address: string;
  protocol?: string;
}): Promise<Record<string, unknown>> {
  if (!isAddress(params.address)) {
    throw SyeniteError.invalidInput(
      `"${params.address}" is not a valid Ethereum address. Provide a 0x-prefixed 42-character hex address.`
    );
  }

  const address = params.address as Address;
  const protocol = params.protocol?.toLowerCase();

  const positionPromises: Promise<PositionData[]>[] = [];

  if (!protocol || protocol === "aave-v3" || protocol === "aave") {
    positionPromises.push(getAavePosition(address));
  }
  if (!protocol || protocol === "morpho-blue" || protocol === "morpho") {
    positionPromises.push(getMorphoPosition(address));
  }
  if (!protocol || protocol === "spark") {
    positionPromises.push(getSparkPosition(address));
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
