type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const minLevel: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[minLevel];
}

function emit(entry: LogEntry): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    ...entry,
  });
  if (entry.level === "error") {
    process.stderr.write(line + "\n");
  } else {
    process.stdout.write(line + "\n");
  }
}

export const log = {
  info(msg: string, fields?: Record<string, unknown>) {
    if (shouldLog("info")) emit({ level: "info", msg, ...fields });
  },
  warn(msg: string, fields?: Record<string, unknown>) {
    if (shouldLog("warn")) emit({ level: "warn", msg, ...fields });
  },
  error(msg: string, fields?: Record<string, unknown>) {
    if (shouldLog("error")) emit({ level: "error", msg, ...fields });
  },
  debug(msg: string, fields?: Record<string, unknown>) {
    if (shouldLog("debug")) emit({ level: "debug", msg, ...fields });
  },
};
