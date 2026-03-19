import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Structured Logger", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;
  let stderrSpy: ReturnType<typeof vi.spyOn>;
  let originalEnv: string | undefined;

  beforeEach(() => {
    stdoutSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    stderrSpy = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    originalEnv = process.env.LOG_LEVEL;
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
    stderrSpy.mockRestore();
    if (originalEnv !== undefined) {
      process.env.LOG_LEVEL = originalEnv;
    } else {
      delete process.env.LOG_LEVEL;
    }
    vi.resetModules();
  });

  it("emits info logs to stdout as JSON", async () => {
    const { log } = await import("../src/logging/logger.js");
    log.info("test message", { key: "value" });

    expect(stdoutSpy).toHaveBeenCalled();
    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.level).toBe("info");
    expect(parsed.msg).toBe("test message");
    expect(parsed.key).toBe("value");
    expect(parsed.ts).toBeTruthy();
  });

  it("emits error logs to stderr", async () => {
    const { log } = await import("../src/logging/logger.js");
    log.error("something broke", { code: 500 });

    expect(stderrSpy).toHaveBeenCalled();
    const output = stderrSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.level).toBe("error");
    expect(parsed.msg).toBe("something broke");
    expect(parsed.code).toBe(500);
  });

  it("includes ISO timestamp in all log entries", async () => {
    const { log } = await import("../src/logging/logger.js");
    log.warn("timestamp test");

    const output = stdoutSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
