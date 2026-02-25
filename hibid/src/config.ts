export interface Config {
  ntfy: {
    topic: string;
    server?: string;
    token?: string;
  };
  scraper: {
    maxBidThreshold: number;
    checkIntervalMinutes: number;
  };
  keywords: string[];
}

const DEFAULT_KEYWORDS = "air fryer,ninja crispi";

function parseKeywords(envValue: string | undefined): string[] {
  if (!envValue) {
    return DEFAULT_KEYWORDS.split(",");
  }
  return envValue.split(",").map((k) => k.trim()).filter(Boolean);
}

export const config: Config = {
  ntfy: {
    topic: Bun.env.NTFY_TOPIC ?? "hibid-alerts",
    server: Bun.env.NTFY_SERVER,
    token: Bun.env.NTFY_TOKEN,
  },
  scraper: {
    maxBidThreshold: Number(Bun.env.MAX_BID_THRESHOLD) || 100,
    checkIntervalMinutes: Number(Bun.env.CHECK_INTERVAL_MINUTES) || 30,
  },
  keywords: parseKeywords(Bun.env.KEYWORDS),
};
