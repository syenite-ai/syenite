import { describe, it, expect, beforeEach } from "vitest";
import {
  addWatch,
  removeWatch,
  listWatches,
  getAlerts,
  addAlert,
  acknowledgeAlerts,
  getWatch,
} from "../src/data/alerts.js";

describe("Alert Watch System", () => {
  // Note: alerts module uses module-level state. Tests run sequentially.

  describe("addWatch", () => {
    it("creates a watch with generated ID and timestamp", () => {
      const watch = addWatch({
        address: "0x1234567890123456789012345678901234567890",
        healthFactorThreshold: 1.5,
      });

      expect(watch.id).toMatch(/^watch_\d+$/);
      expect(watch.address).toBe("0x1234567890123456789012345678901234567890");
      expect(watch.healthFactorThreshold).toBe(1.5);
      expect(watch.createdAt).toBeTruthy();
    });

    it("assigns unique IDs to each watch", () => {
      const w1 = addWatch({ address: "0xaaa", healthFactorThreshold: 1.5 });
      const w2 = addWatch({ address: "0xbbb", healthFactorThreshold: 2.0 });

      expect(w1.id).not.toBe(w2.id);
    });

    it("stores optional protocol and chain", () => {
      const watch = addWatch({
        address: "0xccc",
        protocol: "aave-v3",
        chain: "arbitrum",
        healthFactorThreshold: 1.3,
      });

      expect(watch.protocol).toBe("aave-v3");
      expect(watch.chain).toBe("arbitrum");
    });
  });

  describe("getWatch", () => {
    it("retrieves an existing watch by ID", () => {
      const created = addWatch({ address: "0xddd", healthFactorThreshold: 1.5 });
      const retrieved = getWatch(created.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.address).toBe("0xddd");
    });

    it("returns undefined for non-existent ID", () => {
      expect(getWatch("watch_99999")).toBeUndefined();
    });
  });

  describe("removeWatch", () => {
    it("removes an existing watch and returns true", () => {
      const watch = addWatch({ address: "0xeee", healthFactorThreshold: 1.5 });
      expect(removeWatch(watch.id)).toBe(true);
      expect(getWatch(watch.id)).toBeUndefined();
    });

    it("returns false for non-existent watch", () => {
      expect(removeWatch("watch_nonexistent")).toBe(false);
    });
  });

  describe("listWatches", () => {
    it("returns an array of all watches", () => {
      const watches = listWatches();
      expect(Array.isArray(watches)).toBe(true);
      expect(watches.length).toBeGreaterThan(0);
    });
  });

  describe("Alert management", () => {
    it("adds and retrieves alerts", () => {
      const watch = addWatch({ address: "0xfff", healthFactorThreshold: 1.5 });

      addAlert({
        watchId: watch.id,
        type: "health_factor_low",
        severity: "warning",
        message: "Health factor at 1.3",
        data: { healthFactor: 1.3 },
      });

      const alerts = getAlerts(watch.id);
      expect(alerts.length).toBeGreaterThanOrEqual(1);

      const alert = alerts[alerts.length - 1];
      expect(alert.watchId).toBe(watch.id);
      expect(alert.severity).toBe("warning");
      expect(alert.acknowledged).toBe(false);
      expect(alert.createdAt).toBeTruthy();
    });

    it("filters alerts by watchId", () => {
      const w1 = addWatch({ address: "0xaaa1", healthFactorThreshold: 1.5 });
      const w2 = addWatch({ address: "0xbbb1", healthFactorThreshold: 1.5 });

      addAlert({
        watchId: w1.id,
        type: "health_factor_critical",
        severity: "critical",
        message: "Critical!",
        data: {},
      });

      const w1Alerts = getAlerts(w1.id);
      const w2Alerts = getAlerts(w2.id);

      expect(w1Alerts.some((a) => a.severity === "critical")).toBe(true);
      expect(w2Alerts.some((a) => a.severity === "critical")).toBe(false);
    });

    it("acknowledges alerts for a watch", () => {
      const watch = addWatch({ address: "0xccc1", healthFactorThreshold: 1.5 });

      addAlert({
        watchId: watch.id,
        type: "health_factor_low",
        severity: "warning",
        message: "Test",
        data: {},
      });

      const count = acknowledgeAlerts(watch.id);
      expect(count).toBeGreaterThanOrEqual(1);

      const unacked = getAlerts(watch.id, true);
      expect(unacked.length).toBe(0);
    });

    it("filters to unacknowledged only", () => {
      const watch = addWatch({ address: "0xddd1", healthFactorThreshold: 1.5 });

      addAlert({
        watchId: watch.id,
        type: "health_factor_low",
        severity: "warning",
        message: "Unacked",
        data: {},
      });

      const before = getAlerts(watch.id, true);
      expect(before.length).toBeGreaterThanOrEqual(1);

      acknowledgeAlerts(watch.id);

      const after = getAlerts(watch.id, true);
      expect(after.length).toBe(0);
    });
  });
});
