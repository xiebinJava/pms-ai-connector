export interface OutputMeta {
  requestId: string;
  clientId?: string;
  auditId?: string;
  refreshScopes?: string[];
}

export interface CliErrorOutput {
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

export interface SuccessEnvelope<T> {
  ok: true;
  data: T;
  meta: OutputMeta;
}

export interface ErrorEnvelope {
  ok: false;
  error: CliErrorOutput;
  meta: OutputMeta;
}

export class OutputWriter {
  constructor(
    private readonly writeStdout: (value: string) => void = (value) => process.stdout.write(value),
    private readonly writeStderr: (value: string) => void = (value) => process.stderr.write(value),
    private readonly setExitCode: (value: number) => void = (value) => { process.exitCode = value; },
  ) {}

  success<T>(data: T, meta: OutputMeta): SuccessEnvelope<T> {
    const envelope: SuccessEnvelope<T> = {
      ok: true,
      data,
      meta: { clientId: "pms-cli", refreshScopes: [], ...meta },
    };
    this.writeStdout(`${JSON.stringify(envelope)}\n`);
    return envelope;
  }

  failure(error: CliErrorOutput, meta?: Partial<OutputMeta>): ErrorEnvelope {
    const envelope: ErrorEnvelope = {
      ok: false,
      error,
      meta: {
        clientId: "pms-cli",
        refreshScopes: [],
        requestId: error.requestId ?? meta?.requestId ?? "unknown",
        ...meta,
      },
    };
    this.writeStderr(`${JSON.stringify(envelope)}\n`);
    this.setExitCode(1);
    return envelope;
  }
}
