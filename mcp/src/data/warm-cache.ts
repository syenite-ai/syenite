import { log } from "../logging/logger.js";
import { getAaveRates, getSparkRates } from "./aave.js";
import { getMorphoRates } from "./morpho.js";
import { getCompoundRates } from "./compound.js";
import { getFluidRates } from "./fluid.js";
import { getTokenPrice } from "./prices.js";
import { CACHE_TTL, TOKEN_PRICE_FEED } from "./types.js";

const WARM_FEEDS = Object.keys(TOKEN_PRICE_FEED);
const BORROW_ASSETS = ["USDC"];

async function warmPrices(): Promise<void> {
  const feeds = [...new Set(Object.values(TOKEN_PRICE_FEED))];
  await Promise.allSettled(feeds.map((pair) => {
    const symbol = Object.entries(TOKEN_PRICE_FEED).find(([, v]) => v === pair)?.[0];
    if (symbol) return getTokenPrice(symbol);
  }));
}

async function warmRates(): Promise<void> {
  for (const borrowAsset of BORROW_ASSETS) {
    await Promise.allSettled([
      getAaveRates("all", borrowAsset),
      getMorphoRates("all", borrowAsset),
      getSparkRates("all", borrowAsset),
      getCompoundRates("all", borrowAsset),
      getFluidRates("all", borrowAsset),
    ]);
  }
}

export async function warmCache(): Promise<void> {
  const start = Date.now();
  log.info("cache warm-up starting");

  try {
    await warmPrices();
    log.info("cache warm-up: prices done", { elapsed: Date.now() - start });
  } catch (e) {
    log.warn("cache warm-up: prices failed", { error: e instanceof Error ? e.message : String(e) });
  }

  try {
    await warmRates();
    log.info("cache warm-up: rates done", { elapsed: Date.now() - start });
  } catch (e) {
    log.warn("cache warm-up: rates failed", { error: e instanceof Error ? e.message : String(e) });
  }

  log.info("cache warm-up complete", { elapsed: Date.now() - start });
}

let refreshInterval: ReturnType<typeof setInterval> | null = null;

export function startBackgroundRefresh(): void {
  if (refreshInterval) return;

  const priceInterval = Math.floor(CACHE_TTL.prices * 1000 * 0.75);
  const rateInterval = Math.floor(CACHE_TTL.rates * 1000 * 0.75);

  setInterval(async () => {
    try {
      await warmPrices();
      log.debug("background refresh: prices");
    } catch (e) {
      log.warn("background refresh: prices failed", { error: e instanceof Error ? e.message : String(e) });
    }
  }, priceInterval);

  refreshInterval = setInterval(async () => {
    try {
      await warmRates();
      log.debug("background refresh: rates");
    } catch (e) {
      log.warn("background refresh: rates failed", { error: e instanceof Error ? e.message : String(e) });
    }
  }, rateInterval);

  log.info("background cache refresh started", {
    priceIntervalMs: priceInterval,
    rateIntervalMs: rateInterval,
  });
}
