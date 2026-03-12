import { Database } from 'bun:sqlite';
import type { DashboardState, NtfySettings, ScanSummary, WatchProduct } from './types';

interface RawWatchRow {
  id: number;
  title: string;
  reference_price_cents: number;
  price_source: 'auto' | 'manual';
  active: number;
  created_at_ms: number;
  updated_at_ms: number;
}

export interface UpsertWatchInput {
  id?: number;
  title: string;
  referencePriceCents: number;
  priceSource: 'auto' | 'manual';
  sourceUrls: string[];
  hibidUrls: string[];
  keywords: string[];
  active?: boolean;
}

export class AppDb {
  private readonly db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL;');
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.migrate();
    this.seedSettings();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS watch_products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        reference_price_cents INTEGER NOT NULL,
        price_source TEXT NOT NULL CHECK(price_source IN ('auto','manual')),
        active INTEGER NOT NULL DEFAULT 1,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS watch_source_urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watch_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        FOREIGN KEY (watch_id) REFERENCES watch_products(id) ON DELETE CASCADE,
        UNIQUE (watch_id, url)
      );

      CREATE TABLE IF NOT EXISTS watch_hibid_urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watch_id INTEGER NOT NULL,
        url TEXT NOT NULL,
        FOREIGN KEY (watch_id) REFERENCES watch_products(id) ON DELETE CASCADE,
        UNIQUE (watch_id, url)
      );

      CREATE TABLE IF NOT EXISTS watch_keywords (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watch_id INTEGER NOT NULL,
        keyword TEXT NOT NULL,
        FOREIGN KEY (watch_id) REFERENCES watch_products(id) ON DELETE CASCADE,
        UNIQUE (watch_id, keyword)
      );

      CREATE TABLE IF NOT EXISTS hibid_lots (
        lot_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        current_bid_cents INTEGER NOT NULL,
        minutes_remaining INTEGER,
        end_at_ms INTEGER,
        updated_at_ms INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        watch_id INTEGER NOT NULL,
        lot_id TEXT NOT NULL,
        ratio REAL NOT NULL,
        minutes_remaining INTEGER,
        first_matched_at_ms INTEGER NOT NULL,
        last_matched_at_ms INTEGER NOT NULL,
        last_notified_bid_cents INTEGER,
        last_notification_reason TEXT,
        notification_count INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (watch_id) REFERENCES watch_products(id) ON DELETE CASCADE,
        FOREIGN KEY (lot_id) REFERENCES hibid_lots(lot_id) ON DELETE CASCADE,
        UNIQUE (watch_id, lot_id)
      );

      CREATE TABLE IF NOT EXISTS notification_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_id INTEGER NOT NULL,
        reason TEXT NOT NULL,
        bid_cents INTEGER NOT NULL,
        created_at_ms INTEGER NOT NULL,
        FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS scan_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at_ms INTEGER NOT NULL,
        finished_at_ms INTEGER,
        total_lots INTEGER NOT NULL DEFAULT 0,
        total_candidates INTEGER NOT NULL DEFAULT 0,
        total_notified INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'ok',
        error_message TEXT
      );
    `);

    // Migration: drop legacy columns if they exist (from v1 amazon-only schema)
    try {
      const cols = this.db
        .query("PRAGMA table_info('watch_products')")
        .all() as Array<{ name: string }>;
      const colNames = cols.map((col) => col.name);
      if (colNames.includes('amazon_url') || colNames.includes('asin')) {
        // Old schema detected — move data to new tables then rebuild
        this.migrateFromV1();
      }
    } catch {
      // table doesn't exist yet, that's fine
    }
  }

  private migrateFromV1(): void {
    // Check if watch_source_urls already has data (migration already ran)
    const count = this.db
      .query('SELECT COUNT(*) AS cnt FROM watch_source_urls')
      .get() as { cnt: number } | null;
    if (count && count.cnt > 0) return;

    // Copy amazon_url into watch_source_urls for existing watches
    try {
      this.db.exec(`
        INSERT OR IGNORE INTO watch_source_urls (watch_id, url)
        SELECT id, amazon_url FROM watch_products WHERE amazon_url IS NOT NULL AND amazon_url != ''
      `);
    } catch {
      // Column doesn't exist — nothing to migrate
    }
  }

  private seedSettings(): void {
    const defaults: Record<string, string> = {
      ntfy_server: Bun.env.NTFY_SERVER ?? 'https://ntfy.sh',
      ntfy_topic: Bun.env.NTFY_TOPIC ?? 'hibid-alerts',
      ntfy_token: Bun.env.NTFY_TOKEN ?? '',
    };

    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO settings (key, value) VALUES ($key, $value)',
    );

    for (const [key, value] of Object.entries(defaults)) {
      stmt.run({ $key: key, $value: value });
    }
  }

  listWatches(): WatchProduct[] {
    const rows = this.db
      .query('SELECT * FROM watch_products ORDER BY created_at_ms DESC')
      .all() as RawWatchRow[];

    const keywordStmt = this.db.prepare(
      'SELECT keyword FROM watch_keywords WHERE watch_id = ? ORDER BY keyword',
    );

    const urlStmt = this.db.prepare(
      'SELECT url FROM watch_source_urls WHERE watch_id = ? ORDER BY id',
    );
    const hibidUrlStmt = this.db.prepare(
      'SELECT url FROM watch_hibid_urls WHERE watch_id = ? ORDER BY id',
    );

    return rows.map((row) => {
      const keywords = (keywordStmt.all(row.id) as Array<{ keyword: string }>).map(
        (entry) => entry.keyword,
      );

      const sourceUrls = (urlStmt.all(row.id) as Array<{ url: string }>).map(
        (entry) => entry.url,
      );
      const hibidUrls = (hibidUrlStmt.all(row.id) as Array<{ url: string }>).map(
        (entry) => entry.url,
      );

      return {
        id: row.id,
        title: row.title,
        referencePriceCents: row.reference_price_cents,
        priceSource: row.price_source,
        active: row.active === 1,
        createdAtMs: row.created_at_ms,
        updatedAtMs: row.updated_at_ms,
        sourceUrls,
        hibidUrls,
        keywords,
      } satisfies WatchProduct;
    });
  }

  listActiveWatches(): WatchProduct[] {
    return this.listWatches().filter((watch) => watch.active);
  }

  upsertWatch(input: UpsertWatchInput): WatchProduct {
    const now = Date.now();

    if (input.id) {
      this.db
        .prepare(
          `
            UPDATE watch_products
            SET title = $title,
                reference_price_cents = $reference_price_cents,
                price_source = $price_source,
                active = $active,
                updated_at_ms = $updated_at_ms
            WHERE id = $id
          `,
        )
        .run({
          $id: input.id,
          $title: input.title,
          $reference_price_cents: input.referencePriceCents,
          $price_source: input.priceSource,
          $active: input.active === false ? 0 : 1,
          $updated_at_ms: now,
        });

      this.db.prepare('DELETE FROM watch_keywords WHERE watch_id = ?').run(input.id);
      this.db.prepare('DELETE FROM watch_source_urls WHERE watch_id = ?').run(input.id);
      this.db.prepare('DELETE FROM watch_hibid_urls WHERE watch_id = ?').run(input.id);

      this.insertKeywords(input.id, input.keywords);
      this.insertSourceUrls(input.id, input.sourceUrls);
      this.insertHibidUrls(input.id, input.hibidUrls);

      const watch = this.listWatches().find((entry) => entry.id === input.id);
      if (!watch) {
        throw new Error('Failed to update watch');
      }
      return watch;
    }

    const result = this.db
      .prepare(
        `
          INSERT INTO watch_products
            (title, reference_price_cents, price_source, active, created_at_ms, updated_at_ms)
          VALUES
            ($title, $reference_price_cents, $price_source, 1, $created_at_ms, $updated_at_ms)
        `,
      )
      .run({
        $title: input.title,
        $reference_price_cents: input.referencePriceCents,
        $price_source: input.priceSource,
        $created_at_ms: now,
        $updated_at_ms: now,
      });

    const watchId = Number(result.lastInsertRowid);
    this.insertKeywords(watchId, input.keywords);
    this.insertSourceUrls(watchId, input.sourceUrls);
    this.insertHibidUrls(watchId, input.hibidUrls);

    const watch = this.listWatches().find((entry) => entry.id === watchId);
    if (!watch) {
      throw new Error('Failed to create watch');
    }
    return watch;
  }

  private insertKeywords(watchId: number, keywords: string[]): void {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO watch_keywords (watch_id, keyword) VALUES (?, ?)',
    );
    for (const keyword of keywords) {
      stmt.run(watchId, keyword.toLowerCase());
    }
  }

  private insertSourceUrls(watchId: number, urls: string[]): void {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO watch_source_urls (watch_id, url) VALUES (?, ?)',
    );
    for (const url of urls) {
      stmt.run(watchId, url);
    }
  }

  private insertHibidUrls(watchId: number, urls: string[]): void {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO watch_hibid_urls (watch_id, url) VALUES (?, ?)',
    );
    for (const url of urls) {
      stmt.run(watchId, url);
    }
  }

  deleteWatch(id: number): void {
    this.db.prepare('DELETE FROM watch_products WHERE id = ?').run(id);
  }

  getNtfySettings(): NtfySettings {
    const rows = this.db.query('SELECT key, value FROM settings').all() as Array<{
      key: string;
      value: string;
    }>;

    const map = new Map(rows.map((row) => [row.key, row.value]));
    return {
      server: map.get('ntfy_server') ?? 'https://ntfy.sh',
      topic: map.get('ntfy_topic') ?? 'hibid-alerts',
      token: map.get('ntfy_token') ?? '',
    };
  }

  setNtfySettings(settings: NtfySettings): NtfySettings {
    const upsert = this.db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    );

    upsert.run('ntfy_server', settings.server);
    upsert.run('ntfy_topic', settings.topic);
    upsert.run('ntfy_token', settings.token);
    return this.getNtfySettings();
  }

  startScanRun(startedAtMs: number): number {
    const result = this.db
      .prepare('INSERT INTO scan_runs (started_at_ms) VALUES (?)')
      .run(startedAtMs);
    return Number(result.lastInsertRowid);
  }

  finishScanRun(summary: ScanSummary): void {
    this.db
      .prepare(
        `
          UPDATE scan_runs
          SET finished_at_ms = $finished,
              total_lots = $lots,
              total_candidates = $candidates,
              total_notified = $notified,
              status = $status,
              error_message = $error
          WHERE id = $id
        `,
      )
      .run({
        $id: summary.runId,
        $finished: summary.finishedAtMs,
        $lots: summary.totalLots,
        $candidates: summary.totalCandidates,
        $notified: summary.totalNotified,
        $status: summary.status,
        $error: summary.errorMessage,
      });
  }

  getLatestScan(): ScanSummary | null {
    const row = this.db
      .query('SELECT * FROM scan_runs ORDER BY started_at_ms DESC LIMIT 1')
      .get() as
      | {
          id: number;
          started_at_ms: number;
          finished_at_ms: number | null;
          total_lots: number;
          total_candidates: number;
          total_notified: number;
          status: 'ok' | 'error';
          error_message: string | null;
        }
      | null;

    if (!row || row.finished_at_ms === null) {
      return null;
    }

    return {
      runId: row.id,
      startedAtMs: row.started_at_ms,
      finishedAtMs: row.finished_at_ms,
      totalLots: row.total_lots,
      totalCandidates: row.total_candidates,
      totalNotified: row.total_notified,
      status: row.status,
      errorMessage: row.error_message,
    };
  }

  upsertLot(input: {
    lotId: string;
    title: string;
    url: string;
    currentBidCents: number;
    minutesRemaining: number | null;
    endAtMs: number | null;
  }): void {
    this.db
      .prepare(
        `
          INSERT INTO hibid_lots
            (lot_id, title, url, current_bid_cents, minutes_remaining, end_at_ms, updated_at_ms)
          VALUES
            ($lot_id, $title, $url, $current_bid_cents, $minutes_remaining, $end_at_ms, $updated_at_ms)
          ON CONFLICT(lot_id) DO UPDATE SET
            title = excluded.title,
            url = excluded.url,
            current_bid_cents = excluded.current_bid_cents,
            minutes_remaining = excluded.minutes_remaining,
            end_at_ms = excluded.end_at_ms,
            updated_at_ms = excluded.updated_at_ms
        `,
      )
      .run({
        $lot_id: input.lotId,
        $title: input.title,
        $url: input.url,
        $current_bid_cents: input.currentBidCents,
        $minutes_remaining: input.minutesRemaining,
        $end_at_ms: input.endAtMs,
        $updated_at_ms: Date.now(),
      });
  }

  getMatchState(watchId: number, lotId: string): {
    id: number;
    lastNotifiedBidCents: number | null;
    lastReason: string | null;
    notificationCount: number;
  } | null {
    const row = this.db
      .prepare(
        `
          SELECT id, last_notified_bid_cents, last_notification_reason, notification_count
          FROM matches
          WHERE watch_id = ? AND lot_id = ?
        `,
      )
      .get(watchId, lotId) as
      | {
          id: number;
          last_notified_bid_cents: number | null;
          last_notification_reason: string | null;
          notification_count: number;
        }
      | null;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      lastNotifiedBidCents: row.last_notified_bid_cents,
      lastReason: row.last_notification_reason,
      notificationCount: row.notification_count,
    };
  }

  touchMatch(input: {
    watchId: number;
    lotId: string;
    ratio: number;
    minutesRemaining: number | null;
  }): number {
    const now = Date.now();
    this.db
      .prepare(
        `
          INSERT INTO matches
            (watch_id, lot_id, ratio, minutes_remaining, first_matched_at_ms, last_matched_at_ms)
          VALUES
            ($watch_id, $lot_id, $ratio, $minutes_remaining, $now, $now)
          ON CONFLICT(watch_id, lot_id) DO UPDATE SET
            ratio = excluded.ratio,
            minutes_remaining = excluded.minutes_remaining,
            last_matched_at_ms = $now
        `,
      )
      .run({
        $watch_id: input.watchId,
        $lot_id: input.lotId,
        $ratio: input.ratio,
        $minutes_remaining: input.minutesRemaining,
        $now: now,
      });

    const row = this.db
      .prepare('SELECT id FROM matches WHERE watch_id = ? AND lot_id = ?')
      .get(input.watchId, input.lotId) as { id: number } | null;

    if (!row) {
      throw new Error('Failed to touch match state');
    }
    return row.id;
  }

  recordNotification(matchId: number, reason: string, bidCents: number): void {
    const now = Date.now();

    this.db
      .prepare(
        `
          UPDATE matches
          SET last_notified_bid_cents = $bid,
              last_notification_reason = $reason,
              notification_count = notification_count + 1
          WHERE id = $id
        `,
      )
      .run({
        $id: matchId,
        $bid: bidCents,
        $reason: reason,
      });

    this.db
      .prepare(
        'INSERT INTO notification_events (match_id, reason, bid_cents, created_at_ms) VALUES (?, ?, ?, ?)',
      )
      .run(matchId, reason, bidCents, now);
  }

  getDashboardState(): DashboardState {
    const recentMatches = this.db
      .query(
        `
          SELECT
            w.title AS watch_title,
            l.title AS lot_title,
            l.url AS lot_url,
            l.current_bid_cents AS bid_cents,
            m.ratio AS ratio,
            l.minutes_remaining AS minutes_remaining,
            m.last_matched_at_ms AS updated_at_ms
          FROM matches m
          JOIN watch_products w ON w.id = m.watch_id
          JOIN hibid_lots l ON l.lot_id = m.lot_id
          ORDER BY m.last_matched_at_ms DESC
          LIMIT 30
        `,
      )
      .all() as Array<{
      watch_title: string;
      lot_title: string;
      lot_url: string;
      bid_cents: number;
      ratio: number;
      minutes_remaining: number | null;
      updated_at_ms: number;
    }>;

    return {
      watches: this.listWatches(),
      recentMatches: recentMatches.map((row) => ({
        watchTitle: row.watch_title,
        lotTitle: row.lot_title,
        lotUrl: row.lot_url,
        bidCents: row.bid_cents,
        ratio: row.ratio,
        minutesRemaining: row.minutes_remaining,
        updatedAtMs: row.updated_at_ms,
      })),
      latestRun: this.getLatestScan(),
      ntfy: this.getNtfySettings(),
    };
  }
}
