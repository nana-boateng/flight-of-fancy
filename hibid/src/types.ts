export interface WatchProduct {
  id: number;
  title: string;
  referencePriceCents: number;
  priceSource: 'auto' | 'manual';
  active: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  sourceUrls: string[];
  hibidUrls: string[];
  keywords: string[];
}

export interface HibidLot {
  lotId: string;
  title: string;
  url: string;
  currentBidCents: number;
  minutesRemaining: number | null;
  endAtMs: number | null;
}

export interface MatchCandidate {
  watchId: number;
  lot: HibidLot;
  bargainRatio: number;
}

export interface NtfySettings {
  server: string;
  topic: string;
  token: string;
}

export interface ScanSummary {
  runId: number;
  startedAtMs: number;
  finishedAtMs: number;
  totalLots: number;
  totalCandidates: number;
  totalNotified: number;
  status: 'ok' | 'error';
  errorMessage: string | null;
}

export interface DashboardState {
  watches: WatchProduct[];
  recentMatches: Array<{
    watchTitle: string;
    lotTitle: string;
    lotUrl: string;
    bidCents: number;
    ratio: number;
    minutesRemaining: number | null;
    updatedAtMs: number;
  }>;
  latestRun: ScanSummary | null;
  ntfy: NtfySettings;
}
