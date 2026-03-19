import { describe, it, expect, beforeEach, vi } from "vitest";

// Must mock db before importing cache
vi.mock("../src/data/db.js", () => ({
  hasDatabase: () => false,
  getPool: () => { throw new Error("No DB in test"); },
}));

vi.mock("../src/logging/metrics.js", () => ({
  recordCacheHit: vi.fn(),
  recordCacheMiss: vi.fn(),
}));

import { cacheGet, cacheSet, cachePurgeExpired } from "../src/data/cache.js";
import { recordCacheHit, recordCacheMiss } from "../src/logging/metrics.js";

describe("In-memory cache (no DB)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null for missing keys", async () => {
    const result = await cacheGet("nonexistent_key_" + Date.now());
    expect(result).toBeNull();
    expect(recordCacheMiss).toHaveBeenCalledOnce();
  });

  it("stores and retrieves values", async () => {
    const key = "test_key_" + Date.now();
    const value = { foo: "bar", count: 42 };

    await cacheSet(key, value, 60);
    const result = await cacheGet<typeof value>(key);

    expect(result).toEqual(value);
    expect(recordCacheHit).toHaveBeenCalledOnce();
  });

  it("respects TTL expiration", async () => {
    const key = "expire_test_" + Date.now();
    // TTL of -1 ensures expiresAt is in the past
    await cacheSet(key, "test", -1);

    const result = await cacheGet(key);
    expect(result).toBeNull();
    expect(recordCacheMiss).toHaveBeenCalled();
  });

  it("overwrites existing keys", async () => {
    const key = "overwrite_test_" + Date.now();

    await cacheSet(key, "first", 60);
    await cacheSet(key, "second", 60);

    const result = await cacheGet(key);
    expect(result).toBe("second");
  });

  it("purges expired entries", async () => {
    const key1 = "purge_fresh_" + Date.now();
    const key2 = "purge_stale_" + Date.now();

    await cacheSet(key1, "fresh", 3600);
    await cacheSet(key2, "stale", -1); // already expired

    const purged = await cachePurgeExpired();
    expect(purged).toBeGreaterThanOrEqual(1);

    expect(await cacheGet(key1)).toBe("fresh");
    expect(await cacheGet(key2)).toBeNull();
  });

  it("handles complex objects", async () => {
    const key = "complex_" + Date.now();
    const value = {
      rates: [{ protocol: "aave-v3", borrowAPY: 3.45, chain: "ethereum" }],
      nested: { deep: { value: true } },
      timestamp: new Date().toISOString(),
    };

    await cacheSet(key, value, 60);
    const result = await cacheGet<typeof value>(key);

    expect(result).toEqual(value);
    expect(result?.rates[0].protocol).toBe("aave-v3");
    expect(result?.nested.deep.value).toBe(true);
  });
});
