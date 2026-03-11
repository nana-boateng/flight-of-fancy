export interface AppConfig {
  host: string;
  port: number;
  dbPath: string;
  hibidBaseUrl: string;
  scrapeTimeoutMs: number;
  hourlyIntervalMs: number;
  bargainThreshold: number;
  maxEndingMinutes: number;
  bigTicketMinCents: number;
}

function parseNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(): AppConfig {
  const port = parseNumber(Bun.env.PORT, 3000);
  const intervalMinutes = parseNumber(Bun.env.SCAN_INTERVAL_MINUTES, 60);
  const bargainThreshold = parseNumber(Bun.env.BARGAIN_THRESHOLD, 0.7);
  const maxEndingMinutes = parseNumber(Bun.env.MAX_ENDING_MINUTES, 60);
  const bigTicketMin = parseNumber(Bun.env.BIG_TICKET_MIN_DOLLARS, 100);

  return {
    host: Bun.env.BIND_HOST ?? '127.0.0.1',
    port,
    dbPath: Bun.env.DB_PATH ?? 'hibid.db',
    hibidBaseUrl: Bun.env.HIBID_BASE_URL ?? 'https://ontario.hibid.com/lots',
    scrapeTimeoutMs: parseNumber(Bun.env.SCRAPE_TIMEOUT_MS, 45000),
    hourlyIntervalMs: intervalMinutes * 60 * 1000,
    bargainThreshold,
    maxEndingMinutes,
    bigTicketMinCents: Math.round(bigTicketMin * 100),
  };
}
