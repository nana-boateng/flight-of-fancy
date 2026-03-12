import { loadConfig } from './config';
import { AppDb } from './db';
import { scrapeLotsByDirectUrls } from './hibid';
import { analyzeUrls } from './product-resolver';
import { ScanService } from './scanner';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

function securityHeaders(contentType: string): HeadersInit {
  return {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  };
}

async function parseJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (typeof body !== 'object' || body === null) {
      return {};
    }
    return body as Record<string, unknown>;
  } catch {
    return {};
  }
}

function parseMoney(input: unknown): number | null {
  if (input === null || input === undefined || input === '') {
    return null;
  }
  const value = Number(input);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return value;
}

function parseKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => String(entry).trim().toLowerCase())
    .filter((entry, index, arr) => entry.length > 0 && arr.indexOf(entry) === index);
}

function parseStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  return input
    .map((entry) => String(entry).trim())
    .filter((entry) => entry.length > 0);
}

function isHibidLotUrl(input: string): boolean {
  try {
    const parsed = new URL(input);
    return parsed.hostname.toLowerCase().endsWith('hibid.com') && /\/lot\/\d+/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export async function startApp(): Promise<void> {
  const config = loadConfig();
  const db = new AppDb(config.dbPath);
  const scanner = new ScanService(db, config);

  const runAndLog = async (): Promise<void> => {
    try {
      const summary = await scanner.runScan();
      console.info(
        `[scan] lots=${summary.totalLots} candidates=${summary.totalCandidates} notified=${summary.totalNotified}`,
      );
    } catch (error) {
      console.error('[scan] failed', error);
    }
  };

  setInterval(() => {
    void runAndLog();
  }, config.hourlyIntervalMs);

  void runAndLog();

  Bun.serve({
    hostname: config.host,
    port: config.port,
    routes: {
      '/': () =>
        new Response(Bun.file('public/index.html'), {
          headers: securityHeaders('text/html; charset=utf-8'),
        }),
      '/app.js': () =>
        new Response(Bun.file('public/app.js'), {
          headers: securityHeaders('application/javascript; charset=utf-8'),
        }),
      '/styles.css': () =>
        new Response(Bun.file('public/styles.css'), {
          headers: securityHeaders('text/css; charset=utf-8'),
        }),
      '/api/dashboard': () => json(db.getDashboardState()),

      '/api/analyze-urls': {
        POST: async (req) => {
          const body = await parseJson(req);
          const urls = parseStringArray(body.urls);
          const manualTitle =
            typeof body.manualTitle === 'string' && body.manualTitle.trim()
              ? body.manualTitle.trim()
              : null;
          const manualPrice = parseMoney(body.manualReferencePrice ?? null);
          const manualAsin =
            typeof body.manualAsin === 'string' && body.manualAsin.trim()
              ? body.manualAsin.trim()
              : null;

          if (urls.length === 0 && !manualAsin) {
            return json({ error: 'At least one URL or an ASIN is required' }, 400);
          }

          try {
            const result = await analyzeUrls({
              urls,
              manualAsin,
              manualTitle,
              manualReferencePriceDollars: manualPrice,
            });

            return json(result);
          } catch (error) {
            return json(
              { error: error instanceof Error ? error.message : 'Analysis failed' },
              422,
            );
          }
        },
      },

      '/api/watches': {
        GET: () => json(db.listWatches()),
        POST: async (req) => {
          const body = await parseJson(req);
          const title = String(body.title ?? '').trim();
          const keywords = parseKeywords(body.keywords);
          const sourceUrls = parseStringArray(body.sourceUrls);
          const hibidUrls = parseStringArray(body.hibidUrls);
          const referencePriceCents = Math.round(Number(body.referencePriceCents ?? 0));
          const priceSource =
            body.priceSource === 'manual' || body.priceSource === 'auto'
              ? body.priceSource
              : 'manual';

          if (!title) {
            return json({ error: 'title is required' }, 400);
          }
          if (keywords.length === 0 && hibidUrls.length === 0) {
            return json({ error: 'Provide at least one keyword or one direct HiBid link' }, 400);
          }
          if (!Number.isFinite(referencePriceCents) || referencePriceCents <= 0) {
            return json({ error: 'A valid reference price is required' }, 400);
          }

          try {
            const created = db.upsertWatch({
              title,
              referencePriceCents,
              priceSource,
              sourceUrls,
              hibidUrls,
              keywords,
            });

            return json(created, 201);
          } catch (error) {
            return json(
              { error: error instanceof Error ? error.message : 'Could not add watch' },
              422,
            );
          }
        },
      },

      '/api/watches/direct-lot': {
        POST: async (req) => {
          const body = await parseJson(req);
          const lotUrl = String(body.lotUrl ?? '').trim();
          const manualTitle =
            typeof body.manualTitle === 'string' && body.manualTitle.trim().length > 0
              ? body.manualTitle.trim()
              : null;
          const manualReferencePrice = parseMoney(body.manualReferencePrice ?? null);

          if (!lotUrl || !isHibidLotUrl(lotUrl)) {
            return json({ error: 'Provide a valid HiBid lot URL' }, 400);
          }

          let lot: Awaited<ReturnType<typeof scrapeLotsByDirectUrls>>[number] | null = null;
          try {
            const lots = await scrapeLotsByDirectUrls(config, [lotUrl]);
            lot = lots[0] ?? null;
          } catch (error) {
            console.warn('[direct-lot] scrape failed', error);
          }

          const title = manualTitle || lot?.title || 'HiBid Listing';
          const inferredReference =
            manualReferencePrice !== null
              ? Math.round(manualReferencePrice * 100)
              : lot?.currentBidCents
                ? Math.max(Math.round(lot.currentBidCents / config.bargainThreshold), lot.currentBidCents)
                : null;

          if (inferredReference === null || inferredReference <= 0) {
            return json(
              {
                error:
                  'Could not infer a reference price from this lot. Provide a manual reference price.',
              },
              422,
            );
          }

          try {
            const created = db.upsertWatch({
              title,
              referencePriceCents: inferredReference,
              priceSource: manualReferencePrice !== null ? 'manual' : 'auto',
              sourceUrls: [],
              hibidUrls: [lot?.url ?? lotUrl],
              keywords: [],
            });

            return json(created, 201);
          } catch (error) {
            return json(
              { error: error instanceof Error ? error.message : 'Could not add direct listing' },
              422,
            );
          }
        },
      },

      '/api/watches/:id': {
        PATCH: async (req) => {
          const id = Number(req.params.id);
          if (!Number.isFinite(id)) {
            return json({ error: 'Invalid watch id' }, 400);
          }

          const existing = db.listWatches().find((watch) => watch.id === id);
          if (!existing) {
            return json({ error: 'Watch not found' }, 404);
          }

          const body = await parseJson(req);
          const keywords =
            Array.isArray(body.keywords) && body.keywords.length > 0
              ? parseKeywords(body.keywords)
              : existing.keywords;
          const sourceUrls =
            Array.isArray(body.sourceUrls) && body.sourceUrls.length > 0
              ? parseStringArray(body.sourceUrls)
              : existing.sourceUrls;
          const hibidUrls =
            Array.isArray(body.hibidUrls) && body.hibidUrls.length > 0
              ? parseStringArray(body.hibidUrls)
              : existing.hibidUrls;

          if (keywords.length === 0 && hibidUrls.length === 0) {
            return json({ error: 'Provide at least one keyword or one direct HiBid link' }, 400);
          }

          const updated = db.upsertWatch({
            id,
            title:
              typeof body.title === 'string' && body.title.trim()
                ? body.title.trim()
                : existing.title,
            referencePriceCents:
              parseMoney(body.referencePrice) !== null
                ? Math.round(Number(body.referencePrice) * 100)
                : existing.referencePriceCents,
            priceSource:
              parseMoney(body.referencePrice) !== null ? 'manual' : existing.priceSource,
            sourceUrls,
            hibidUrls,
            keywords,
            active: typeof body.active === 'boolean' ? body.active : existing.active,
          });

          return json(updated);
        },
        DELETE: (req) => {
          const id = Number(req.params.id);
          if (!Number.isFinite(id)) {
            return json({ error: 'Invalid watch id' }, 400);
          }
          db.deleteWatch(id);
          return new Response(null, { status: 204 });
        },
      },

      '/api/settings/ntfy': {
        GET: () => json(db.getNtfySettings()),
        PUT: async (req) => {
          const body = await parseJson(req);
          const server = String(body.server ?? '').trim();
          const topic = String(body.topic ?? '').trim();
          const token = String(body.token ?? '').trim();

          if (!server || !topic) {
            return json({ error: 'server and topic are required' }, 400);
          }

          const settings = db.setNtfySettings({ server, topic, token });
          return json(settings);
        },
      },

      '/api/run-now': {
        POST: async () => {
          try {
            const summary = await scanner.runScan();
            return json(summary, 202);
          } catch (error) {
            return json(
              { error: error instanceof Error ? error.message : 'Scan failed' },
              409,
            );
          }
        },
      },
    },
  });

  console.info(`[server] http://${config.host}:${config.port}`);
}
