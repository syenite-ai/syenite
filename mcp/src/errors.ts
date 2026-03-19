export type ErrorCode =
  | "invalid_input"
  | "not_found"
  | "upstream_error"
  | "rate_limited"
  | "internal_error";

export class SyeniteError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = "SyeniteError";
  }

  static invalidInput(message: string): SyeniteError {
    return new SyeniteError("invalid_input", message, false);
  }

  static notFound(message: string): SyeniteError {
    return new SyeniteError("not_found", message, false);
  }

  static upstream(message: string): SyeniteError {
    return new SyeniteError("upstream_error", message, true);
  }

  static rateLimited(message: string): SyeniteError {
    return new SyeniteError("rate_limited", message, true);
  }
}
