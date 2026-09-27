export type PmsClientErrorKind =
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation"
  | "rate_limited"
  | "server"
  | "http"
  | "network"
  | "timeout";

export class PmsClientError extends Error {
  readonly name = "PmsClientError";

  constructor(
    readonly kind: PmsClientErrorKind,
    message: string,
    readonly options: {
      status?: number;
      requestId?: string;
      retryable?: boolean;
    } = {},
  ) {
    super(safeErrorMessage(message, "PMS 请求失败"));
  }

  get status(): number | undefined {
    return this.options.status;
  }

  get requestId(): string | undefined {
    return this.options.requestId;
  }

  get retryable(): boolean {
    return this.options.retryable ?? (this.kind === "server" || this.kind === "rate_limited");
  }
}

export function classifyPmsStatus(
  status: number,
  message: string | undefined,
  requestId?: string,
): PmsClientError {
  const kind: PmsClientErrorKind =
    status === 401 ? "unauthorized"
      : status === 403 ? "forbidden"
        : status === 404 ? "not_found"
          : status === 409 ? "conflict"
            : status === 422 || status === 400 ? "validation"
              : status === 429 ? "rate_limited"
                : status >= 500 ? "server"
                  : "http";
  return new PmsClientError(kind, message ?? `PMS 请求失败（${status}）`, {
    status,
    requestId,
  });
}

export function safeErrorMessage(value: string | undefined, fallback: string): string {
  if (!value || !value.trim()) return fallback;
  return value
    .replace(/bearer\s+[^\s]+/gi, "Bearer [redacted]")
    .replace(/((?:token|password|secret)\s*[=:]\s*)[^\s,;]+/gi, "$1[redacted]")
    .slice(0, 240);
}
