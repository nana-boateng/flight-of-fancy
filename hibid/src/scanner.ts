import type { AppConfig } from './config';
import type { AppDb } from './db';
import { scrapeLotsByKeywords } from './hibid';
import { sendNtfyNotification } from './notify';
import type { ScanSummary, WatchProduct } from './types';

function keywordMatch(watch: WatchProduct, lotTitle: string): boolean {
  const loweredTitle = lotTitle.toLowerCase();
  return watch.keywords.some((keyword) => loweredTitle.includes(keyword.toLowerCase()));
}

export function shouldNotifyEscalation(input: {
  previousBidCents: number | null;
  previousReason: string | null;
  previousCount: number;
  currentBidCents: number;
  minutesRemaining: number | null;
}): { notify: boolean; reason: 'initial' | 'price_drop' | 'time_critical' | null } {
  if (input.previousCount === 0) {
    return { notify: true, reason: 'initial' };
  }

  if (input.previousCount >= 3) {
    return { notify: false, reason: null };
  }

  if (
    input.previousBidCents !== null &&
    input.currentBidCents <= Math.floor(input.previousBidCents * 0.9)
  ) {
    return { notify: true, reason: 'price_drop' };
  }

  if (
    input.minutesRemaining !== null &&
    input.minutesRemaining <= 15 &&
    input.previousReason !== 'time_critical'
  ) {
    return { notify: true, reason: 'time_critical' };
  }

  return { notify: false, reason: null };
}

export class ScanService {
  private isRunning = false;

  constructor(
    private readonly db: AppDb,
    private readonly config: AppConfig,
  ) {}

  async runScan(): Promise<ScanSummary> {
    if (this.isRunning) {
      throw new Error('Scan already in progress');
    }
    this.isRunning = true;

    const startedAtMs = Date.now();
    const runId = this.db.startScanRun(startedAtMs);

    try {
      const watches = this.db
        .listActiveWatches()
        .filter((watch) => watch.referencePriceCents >= this.config.bigTicketMinCents);

      const keywords = Array.from(
        new Set(watches.flatMap((watch) => watch.keywords.map((keyword) => keyword.toLowerCase()))),
      );

      const lots = await scrapeLotsByKeywords(this.config, keywords);
      for (const lot of lots) {
        this.db.upsertLot(lot);
      }

      let totalCandidates = 0;
      let totalNotified = 0;
      const ntfy = this.db.getNtfySettings();

      for (const watch of watches) {
        for (const lot of lots) {
          if (!keywordMatch(watch, lot.title)) {
            continue;
          }
          if (lot.minutesRemaining === null || lot.minutesRemaining > this.config.maxEndingMinutes) {
            continue;
          }

          const ratio = lot.currentBidCents / watch.referencePriceCents;
          if (ratio >= this.config.bargainThreshold) {
            continue;
          }
          totalCandidates += 1;

          const matchId = this.db.touchMatch({
            watchId: watch.id,
            lotId: lot.lotId,
            ratio,
            minutesRemaining: lot.minutesRemaining,
          });

          const state = this.db.getMatchState(watch.id, lot.lotId);
          const decision = shouldNotifyEscalation({
            previousBidCents: state?.lastNotifiedBidCents ?? null,
            previousReason: state?.lastReason ?? null,
            previousCount: state?.notificationCount ?? 0,
            currentBidCents: lot.currentBidCents,
            minutesRemaining: lot.minutesRemaining,
          });

          if (!decision.notify || !decision.reason) {
            continue;
          }

          const ratioPct = Math.round(ratio * 1000) / 10;
          const body = [
            `${lot.title}`,
            `Watch: ${watch.title}`,
            `Bid: $${(lot.currentBidCents / 100).toFixed(2)} (${ratioPct}% of reference)`,
            `Time left: ${lot.minutesRemaining} min`,
            lot.url,
          ].join('\n');

          await sendNtfyNotification({
            settings: ntfy,
            title: `HiBid ${decision.reason.replace('_', ' ')} deal`,
            message: body,
            clickUrl: lot.url,
            priority: decision.reason === 'time_critical' ? '4' : '3',
          });

          this.db.recordNotification(matchId, decision.reason, lot.currentBidCents);
          totalNotified += 1;
        }
      }

      const summary: ScanSummary = {
        runId,
        startedAtMs,
        finishedAtMs: Date.now(),
        totalLots: lots.length,
        totalCandidates,
        totalNotified,
        status: 'ok',
        errorMessage: null,
      };

      this.db.finishScanRun(summary);
      return summary;
    } catch (error) {
      const summary: ScanSummary = {
        runId,
        startedAtMs,
        finishedAtMs: Date.now(),
        totalLots: 0,
        totalCandidates: 0,
        totalNotified: 0,
        status: 'error',
        errorMessage: error instanceof Error ? error.message : 'Unknown scan error',
      };
      this.db.finishScanRun(summary);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }
}
