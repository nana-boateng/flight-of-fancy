import puppeteer from 'puppeteer';
import type { AppConfig } from './config';
import type { HibidLot } from './types';

interface RawLot {
  lotId: string;
  title: string;
  url: string;
  currentBidText: string;
  timeText: string;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((value) => value.trim().length > 0)));
}

function parseMoneyToCents(text: string): number {
  const match = text.match(/([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/);
  if (!match?.[1]) {
    return 0;
  }

  const dollars = Number(match[1].replaceAll(',', ''));
  if (!Number.isFinite(dollars)) {
    return 0;
  }
  return Math.round(dollars * 100);
}

function parseMinutesRemaining(timeText: string): number | null {
  const lowered = timeText.toLowerCase();
  if (!lowered) {
    return null;
  }

  const day = Number((lowered.match(/(\d+)\s*d/) ?? [])[1] ?? 0);
  const hour = Number((lowered.match(/(\d+)\s*h/) ?? [])[1] ?? 0);
  const minute = Number((lowered.match(/(\d+)\s*m/) ?? [])[1] ?? 0);

  if (day || hour || minute) {
    return day * 24 * 60 + hour * 60 + minute;
  }

  const minuteWord = lowered.match(/(\d+)\s+minute/);
  if (minuteWord?.[1]) {
    return Number(minuteWord[1]);
  }

  const hourWord = lowered.match(/(\d+)\s+hour/);
  if (hourWord?.[1]) {
    return Number(hourWord[1]) * 60;
  }

  if (lowered.includes('ending') || lowered.includes('ends now')) {
    return 0;
  }

  return null;
}

function toAbsoluteUrl(raw: string): string {
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    return raw;
  }
  return `https://ontario.hibid.com${raw}`;
}

export function extractLotIdFromUrl(url: string): string | null {
  const match = url.match(/\/lot\/(\d+)/i);
  return match?.[1] ?? null;
}

function normalizeRawLot(lot: RawLot): HibidLot {
  const minutesRemaining = parseMinutesRemaining(lot.timeText);
  return {
    lotId: lot.lotId,
    title: lot.title,
    url: toAbsoluteUrl(lot.url),
    currentBidCents: parseMoneyToCents(lot.currentBidText),
    minutesRemaining,
    endAtMs: minutesRemaining === null ? null : Date.now() + minutesRemaining * 60 * 1000,
  };
}

export async function scrapeLotsByKeywords(
  config: AppConfig,
  keywords: string[],
): Promise<HibidLot[]> {
  if (keywords.length === 0) {
    return [];
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    protocolTimeout: config.scrapeTimeoutMs,
  });

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const type = request.resourceType();
      if (type === 'image' || type === 'font' || type === 'stylesheet') {
        void request.abort();
        return;
      }
      void request.continue();
    });

    const deduped = new Map<string, HibidLot>();
    for (const keyword of keywords) {
      try {
        const url = `${config.hibidBaseUrl}?search=${encodeURIComponent(keyword)}&stateprovince=Ontario`;
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: config.scrapeTimeoutMs,
        });

        await page.waitForSelector('.lot-tile, app-lot-tile', {
          timeout: 10000,
        }).catch(() => undefined);

        const rawLots = await page.evaluate(() => {
        const cardNodes = Array.from(document.querySelectorAll('app-lot-tile, .lot-tile'));

        return cardNodes
          .map((card) => {
            const element = card as HTMLElement;
            const idFromNode = element.id.match(/lot-(\d+)/)?.[1] ?? '';
            const linkNode =
              (element.querySelector('.lot-link') as HTMLAnchorElement | null) ||
              (element.querySelector('a[href*="/lot/"]') as HTMLAnchorElement | null);
            const href = linkNode?.getAttribute('href') ?? '';
            const idFromHref = href.match(/\/lot\/(\d+)/)?.[1] ?? '';
            const title =
              element.querySelector('.lot-title')?.textContent?.trim() ||
              linkNode?.textContent?.trim() ||
              '';
            const currentBidText =
              element.querySelector('.lot-high-bid')?.textContent?.trim() ||
              element.querySelector('.lot-price-realized')?.textContent?.trim() ||
              '';
            const timeText =
              element.querySelector('.lot-time-label')?.textContent?.trim() ||
              element.querySelector('.lot-time-left')?.textContent?.trim() ||
              '';

            const lotId = idFromNode || idFromHref;
            if (!lotId || !title || !href) {
              return null;
            }

            return {
              lotId,
              title,
              url: href,
              currentBidText,
              timeText,
            };
          })
          .filter((entry): entry is RawLot => entry !== null);
        });

        for (const lot of rawLots) {
          const normalized = normalizeRawLot(lot);
          deduped.set(normalized.lotId, normalized);
        }
      } catch (error) {
        console.warn('[hibid] keyword scrape failed', keyword, error);
        continue;
      }
    }

    await page.close();
    return Array.from(deduped.values());
  } finally {
    await browser.close();
  }
}

export async function scrapeLotsByDirectUrls(
  config: AppConfig,
  directUrls: string[],
): Promise<HibidLot[]> {
  const urls = uniqueStrings(directUrls).map((url) => toAbsoluteUrl(url));
  if (urls.length === 0) {
    return [];
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    protocolTimeout: config.scrapeTimeoutMs,
  });

  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const type = request.resourceType();
      if (type === 'image' || type === 'font' || type === 'stylesheet') {
        void request.abort();
        return;
      }
      void request.continue();
    });

    const lots: HibidLot[] = [];
    for (const url of urls) {
      const lotIdFromUrl = extractLotIdFromUrl(url);
      if (!lotIdFromUrl) {
        continue;
      }

      try {
        await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout: config.scrapeTimeoutMs,
        });

        await page.waitForSelector('body', { timeout: 10000 }).catch(() => undefined);

        const rawLot = await page.evaluate((fallbackLotId: string, fallbackUrl: string) => {
        const title =
          document.querySelector('.lot-title')?.textContent?.trim() ||
          document.querySelector('h1')?.textContent?.trim() ||
          document.title?.trim() ||
          '';

        const currentBidText =
          document.querySelector('.lot-high-bid')?.textContent?.trim() ||
          document.querySelector('.lot-price-realized')?.textContent?.trim() ||
          document.querySelector('[class*="high-bid"]')?.textContent?.trim() ||
          '';

        const timeText =
          document.querySelector('.lot-time-label')?.textContent?.trim() ||
          document.querySelector('.lot-time-left')?.textContent?.trim() ||
          document.querySelector('[class*="time-left"]')?.textContent?.trim() ||
          '';

        const canonical =
          (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href ||
          window.location.href ||
          fallbackUrl;

        const lotId =
          canonical.match(/\/lot\/(\d+)/i)?.[1] ||
          fallbackLotId;

        if (!title || !lotId) {
          return null;
        }

        return {
          lotId,
          title,
          url: canonical,
          currentBidText,
          timeText,
        };
        }, lotIdFromUrl, url);

        if (!rawLot) {
          continue;
        }

        lots.push(normalizeRawLot(rawLot));
      } catch (error) {
        console.warn('[hibid] direct lot scrape failed', url, error);
        continue;
      }
    }

    await page.close();
    const deduped = new Map<string, HibidLot>();
    for (const lot of lots) {
      deduped.set(lot.lotId, lot);
    }

    return Array.from(deduped.values());
  } finally {
    await browser.close();
  }
}
