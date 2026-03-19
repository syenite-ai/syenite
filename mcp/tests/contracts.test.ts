import { describe, it, expect } from "vitest";
import { lookupContract, getDefaultAllowlist, getAllKnownContracts } from "../src/data/contracts.js";

describe("Contract Registry", () => {
  describe("lookupContract", () => {
    it("finds Li.Fi router on Ethereum", () => {
      const result = lookupContract(1, "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE");
      expect(result).not.toBeNull();
      expect(result!.protocol).toBe("Li.Fi");
      expect(result!.name).toBe("Li.Fi Diamond");
      expect(result!.type).toBe("aggregator");
      expect(result!.risk).toBe("low");
    });

    it("finds Aave V3 Pool on Ethereum", () => {
      const result = lookupContract(1, "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2");
      expect(result).not.toBeNull();
      expect(result!.protocol).toBe("Aave");
    });

    it("finds Li.Fi on Base", () => {
      const result = lookupContract(8453, "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE");
      expect(result).not.toBeNull();
      expect(result!.protocol).toBe("Li.Fi");
    });

    it("finds Aave V3 Pool on Arbitrum", () => {
      const result = lookupContract(42161, "0x794a61358D6845594F94dc1DB02A252b5b4814aD");
      expect(result).not.toBeNull();
      expect(result!.protocol).toBe("Aave");
    });

    it("finds Venus on BNB", () => {
      const result = lookupContract(56, "0xfD36E2c2a6789Db23113685031d7F16329158384");
      expect(result).not.toBeNull();
      expect(result!.protocol).toBe("Venus");
    });

    it("returns null for unknown address", () => {
      const result = lookupContract(1, "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF");
      expect(result).toBeNull();
    });

    it("returns null for unknown chain", () => {
      const result = lookupContract(999, "0x1231DEB6f5749EF6cE6943a275A1D3E7486F4EaE");
      expect(result).toBeNull();
    });

    it("is case-insensitive", () => {
      const result = lookupContract(1, "0x1231deb6f5749ef6ce6943a275a1d3e7486f4eae");
      expect(result).not.toBeNull();
      expect(result!.protocol).toBe("Li.Fi");
    });
  });

  describe("getDefaultAllowlist", () => {
    it("returns Ethereum contracts", () => {
      const list = getDefaultAllowlist(1);
      expect(list.length).toBeGreaterThan(5);
      expect(list.some((a) => a.toLowerCase().includes("1231deb6"))).toBe(true);
    });

    it("returns Base contracts", () => {
      const list = getDefaultAllowlist(8453);
      expect(list.length).toBeGreaterThan(0);
    });

    it("returns empty for unknown chain", () => {
      const list = getDefaultAllowlist(999);
      expect(list).toEqual([]);
    });
  });

  describe("getAllKnownContracts", () => {
    it("covers all 4 chains", () => {
      const all = getAllKnownContracts();
      expect(Object.keys(all)).toContain("1");
      expect(Object.keys(all)).toContain("42161");
      expect(Object.keys(all)).toContain("8453");
      expect(Object.keys(all)).toContain("56");
    });
  });
});
