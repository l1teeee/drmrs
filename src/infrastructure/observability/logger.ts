type LogLevel = "debug" | "info" | "warn" | "error";
type LogField = boolean | number | string | null | undefined;

export function safeErrorCode(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    /^[A-Z0-9_]+$/.test(error.code)
  ) {
    return error.code;
  }

  return "UNKNOWN";
}

export function log(level: LogLevel, msg: string, fields: Record<string, LogField> = {}): void {
  const entry = {
    level,
    msg,
    timestamp: new Date().toISOString(),
    ...fields,
  };

  console.log(JSON.stringify(entry));
}
