const LOG_KEY = 'sv_error_log';
const MAX_ENTRIES = 100;

interface LogEntry {
  ts: number;
  scope: string;
  msg: string;
  stack?: string;
  meta?: any;
}

export function logError(scope: string, error: unknown, meta?: any): void {
  const e = error as any;
  const entry: LogEntry = {
    ts: Date.now(),
    scope,
    msg: e?.message ?? String(error),
    stack: e?.stack,
    meta,
  };
  console.error(`[SV:${scope}]`, error, meta);
  try {
    const raw = localStorage.getItem(LOG_KEY);
    const arr: LogEntry[] = raw ? JSON.parse(raw) : [];
    arr.push(entry);
    if (arr.length > MAX_ENTRIES) arr.splice(0, arr.length - MAX_ENTRIES);
    localStorage.setItem(LOG_KEY, JSON.stringify(arr));
  } catch {}
}

export function getErrorLog(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function clearErrorLog(): void {
  localStorage.removeItem(LOG_KEY);
}
