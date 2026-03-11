import { loadConfig } from './config';
import { AppDb } from './db';
import { resolveAmazonProduct } from './amazon';
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
      '/api/watches': {
        GET: () => json(db.listWatches()),
        POST: async (req) => {
          const body = await parseJson(req);
          const amazonUrl = String(body.amazonUrl ?? '').trim();
          const keywords = parseKeywords(body.keywords);
          const manualReferencePrice = parseMoney(body.manualReferencePrice ?? null);
          const manualTitle =
            typeof body.manualTitle === 'string' && body.manualTitle.trim().length > 0
              ? body.manualTitle.trim()
              : null;

          if (!amazonUrl) {
            return json({ error: 'amazonUrl is required' }, 400);
          }
          if (keywords.length === 0) {
            return json({ error: 'At least one keyword is required' }, 400);
          }

          try {
            const resolved = await resolveAmazonProduct({
              amazonUrl,
              manualReferencePrice,
              manualTitle,
            });

            if (resolved.referencePriceCents === null || resolved.referencePriceCents <= 0) {
              return json(
                {
                  error:
                    'Could not resolve Amazon price. Enter a manual reference price to add this watch.',
                },
                422,
              );
            }

            const created = db.upsertWatch({
              amazonUrl: resolved.amazonUrl,
              asin: resolved.asin,
              title: resolved.title,
              referencePriceCents: resolved.referencePriceCents,
              priceSource: resolved.priceSource,
              keywords,
            });

            return json(created, 201);
          } catch (error) {
            return json(
              {
                error: error instanceof Error ? error.message : 'Could not add watch',
              },
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

          const updated = db.upsertWatch({
            id,
            amazonUrl: existing.amazonUrl,
            asin: existing.asin,
            title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : existing.title,
            referencePriceCents:
              parseMoney(body.referencePrice) !== null
                ? Math.round(Number(body.referencePrice) * 100)
                : existing.referencePriceCents,
            priceSource:
              parseMoney(body.referencePrice) !== null ? 'manual' : existing.priceSource,
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
              {
                error: error instanceof Error ? error.message : 'Scan failed',
              },
              409,
            );
          }
        },
      },
    },
  });

  console.info(`[server] http://${config.host}:${config.port}`);
}
