import { describe, it, expect } from "vitest";
import { SyeniteError } from "../src/errors.js";

describe("SyeniteError", () => {
  it("creates an invalid_input error", () => {
    const err = SyeniteError.invalidInput("bad address");

    expect(err).toBeInstanceOf(SyeniteError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe("invalid_input");
    expect(err.message).toBe("bad address");
    expect(err.retryable).toBe(false);
  });

  it("creates a not_found error", () => {
    const err = SyeniteError.notFound("market not found");

    expect(err.code).toBe("not_found");
    expect(err.retryable).toBe(false);
  });

  it("creates an upstream_error (retryable)", () => {
    const err = SyeniteError.upstream("RPC timeout");

    expect(err.code).toBe("upstream_error");
    expect(err.retryable).toBe(true);
  });

  it("creates a rate_limited error (retryable)", () => {
    const err = SyeniteError.rateLimited("too many requests");

    expect(err.code).toBe("rate_limited");
    expect(err.retryable).toBe(true);
  });

  it("creates an internal error via constructor", () => {
    const err = new SyeniteError("internal_error", "unexpected", false);

    expect(err.code).toBe("internal_error");
    expect(err.retryable).toBe(false);
    expect(err.message).toBe("unexpected");
  });

  it("serialises to JSON correctly", () => {
    const err = SyeniteError.invalidInput("test");
    const json = JSON.parse(JSON.stringify({
      code: err.code,
      message: err.message,
      retryable: err.retryable,
    }));

    expect(json.code).toBe("invalid_input");
    expect(json.message).toBe("test");
    expect(json.retryable).toBe(false);
  });
});
