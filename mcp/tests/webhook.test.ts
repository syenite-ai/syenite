import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { deliverWebhook } from "../src/data/webhook.js";

const mockAlert = {
  watchId: "watch_1",
  type: "health_factor_low" as const,
  severity: "warning" as const,
  message: "Health factor at 1.3",
  data: { healthFactor: 1.3 },
};

describe("Webhook Delivery", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    vi.useRealTimers();
  });

  it("delivers successfully on first attempt", async () => {
    fetchSpy.mockResolvedValue(new Response("ok", { status: 200 }));

    const result = await deliverWebhook("https://example.com/webhook", mockAlert);

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    const [url, options] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://example.com/webhook");
    expect(options?.method).toBe("POST");
    expect(options?.headers).toMatchObject({
      "Content-Type": "application/json",
      "User-Agent": "Syenite-Alerts/1.0",
    });

    const body = JSON.parse(options?.body as string);
    expect(body.source).toBe("syenite-alerts");
    expect(body.version).toBe("1.0");
    expect(body.alert.watchId).toBe("watch_1");
    expect(body.alert.type).toBe("health_factor_low");
    expect(body.alert.message).toContain("1.3");
    expect(body.timestamp).toBeTruthy();
  });

  it("retries on failure and succeeds", async () => {
    fetchSpy
      .mockResolvedValueOnce(new Response("error", { status: 500 }))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));

    const promise = deliverWebhook("https://example.com/webhook", mockAlert);
    // Advance past first retry delay (1s)
    await vi.advanceTimersByTimeAsync(2_000);
    const result = await promise;

    expect(result).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("returns false after exhausting retries", async () => {
    fetchSpy.mockResolvedValue(new Response("error", { status: 500 }));

    const promise = deliverWebhook("https://example.com/webhook", mockAlert);
    // Advance past all retry delays: 1s + 5s + 15s = 21s
    await vi.advanceTimersByTimeAsync(25_000);
    const result = await promise;

    expect(result).toBe(false);
    // MAX_RETRIES (3) + 1 initial = 4 total attempts
    expect(fetchSpy).toHaveBeenCalledTimes(4);
  });

  it("handles network errors gracefully", async () => {
    fetchSpy.mockRejectedValue(new Error("ECONNREFUSED"));

    const promise = deliverWebhook("https://unreachable.example.com/webhook", mockAlert);
    await vi.advanceTimersByTimeAsync(25_000);
    const result = await promise;

    expect(result).toBe(false);
  });

  it("includes correct event header", async () => {
    fetchSpy.mockResolvedValue(new Response("ok", { status: 200 }));

    await deliverWebhook("https://example.com/webhook", mockAlert);

    const [, options] = fetchSpy.mock.calls[0];
    const headers = options?.headers as Record<string, string>;
    expect(headers["X-Syenite-Event"]).toBe("health_factor_low");
  });

  it("sends critical alerts with correct severity", async () => {
    fetchSpy.mockResolvedValue(new Response("ok", { status: 200 }));

    const criticalAlert = {
      ...mockAlert,
      type: "health_factor_critical" as const,
      severity: "critical" as const,
      message: "CRITICAL: liquidation imminent",
    };

    await deliverWebhook("https://example.com/webhook", criticalAlert);

    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options?.body as string);
    expect(body.alert.severity).toBe("critical");
    expect(body.alert.type).toBe("health_factor_critical");

    const headers = options?.headers as Record<string, string>;
    expect(headers["X-Syenite-Event"]).toBe("health_factor_critical");
  });
});
