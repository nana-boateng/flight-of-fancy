import puppeteer, { Browser, Page } from "puppeteer";
import { config } from "./config";
import type { AuctionItem } from "./types";

const BASE_URL = "https://www.hibid.com/lots";

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-software-rasterizer",
        "--disable-extensions",
        "--disable-background-networking",
        "--disable-default-apps",
        "--disable-sync",
        "--disable-translate",
        "--metrics-recording-only",
        "--mute-audio",
        "--no-first-run",
        "--safebrowsing-disable-auto-update",
        "--ignore-certificate-errors",
        "--ignore-ssl-errors",
      ],
      protocolTimeout: 60000,
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

function parseEndTimeString(endsAtRaw: string | undefined): Date | undefined {
  if (!endsAtRaw) return undefined;

  const durationMatch = endsAtRaw.match(/(\d+d)?\s*(\d+h)?\s*(\d+m)?\s*(\d+s)?/);
  if (durationMatch) {
    const days = durationMatch[1] ? parseInt(durationMatch[1], 10) : 0;
    const hours = durationMatch[2] ? parseInt(durationMatch[2], 10) : 0;
    const minutes = durationMatch[3] ? parseInt(durationMatch[3], 10) : 0;
    const seconds = durationMatch[4] ? parseInt(durationMatch[4], 10) : 0;

    if (days > 0 || hours > 0 || minutes > 0 || seconds > 0) {
      const totalMs = (days * 24 * 60 * 60 * 1000) +
        (hours * 60 * 60 * 1000) +
        (minutes * 60 * 1000) +
        (seconds * 1000);
      return new Date(Date.now() + totalMs);
    }
  }

  const endsInMatch = endsAtRaw.match(/ends?\s+in\s+(\d+)\s+(hour|hours|minute|minutes|day|days)/i);
  if (endsInMatch && endsInMatch[1] && endsInMatch[2]) {
    const amount = parseInt(endsInMatch[1], 10);
    const unit = endsInMatch[2].toLowerCase();
    const now = new Date();
    if (unit.startsWith("hour")) {
      now.setHours(now.getHours() + amount);
    } else if (unit.startsWith("minute")) {
      now.setMinutes(now.getMinutes() + amount);
    } else if (unit.startsWith("day")) {
      now.setDate(now.getDate() + amount);
    }
    return now;
  }

  const dateMatch = endsAtRaw.match(/ends?[:\s]+(\d{1,2}\/\d{1,2}\/\d{2,4}\s+\d{1,2}:\d{2})/i);
  if (dateMatch && dateMatch[1]) {
    const parsed = new Date(dateMatch[1]);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  const parsed = new Date(endsAtRaw);
  if (!isNaN(parsed.getTime())) return parsed;

  return undefined;
}

async function scrapeByKeywords(): Promise<AuctionItem[]> {
  const b = await getBrowser();
  const page: Page = await b.newPage();
  const seenIds = new Set<string>();
  const results: AuctionItem[] = [];

  for (const keyword of config.keywords) {
    const url = `${BASE_URL}?search=${encodeURIComponent(keyword)}&stateprovince=Ontario`;
    console.log(`Searching: ${url}`);

    await page.goto(url, { waitUntil: "networkidle0", timeout: 60000 });

    const items = await page.evaluate(() => {
      interface RawAuctionItem {
        id: string;
        title: string;
        currentBid: number;
        url: string;
        category: string;
        endsAt?: string;
      }
      const lots: RawAuctionItem[] = [];

      const containers = document.querySelectorAll(".lot-tile");

      containers.forEach((container) => {
        const containerEl = container as HTMLElement;

        let lotId = "";
        const idEl = containerEl.querySelector("[data-lot-id]");
        if (idEl) {
          lotId = idEl.getAttribute("data-lot-id") || "";
        } else {
          const idMatch = containerEl.id.match(/lot-(\d+)/);
          if (idMatch && idMatch[1]) {
            lotId = idMatch[1];
          }
        }

        if (!lotId) {
          return;
        }

        const titleEl = containerEl.querySelector(".lot-title");
        const title = titleEl?.textContent?.trim() || "";

        let link = "";
        const linkEl = containerEl.querySelector(".lot-link") as HTMLAnchorElement;
        if (linkEl) {
          link = linkEl.href;
        } else {
          const anchor = containerEl.querySelector(`a[href*="/lot/${lotId}/"]`) as HTMLAnchorElement;
          if (anchor) {
            link = anchor.href;
          }
        }

        const priceEl = containerEl.querySelector(".lot-high-bid");
        const priceText = priceEl?.textContent || "";

        const bidMatch = priceText.match(/High Bid:\s*([\d,.]+)/);
        const bid = bidMatch && bidMatch[1] ? parseFloat(bidMatch[1].replace(",", "")) : 0;

        let endsAtRaw: string | undefined;
        const timeSelectors = [
          ".lot-time-left",
          ".lot-end-time",
          ".ends-in",
          "[class*='end-time']",
          "[class*='ends-in']",
          "[data-ends-at]",
          "time[datetime]",
        ];
        for (const selector of timeSelectors) {
          const timeEl = containerEl.querySelector(selector);
          if (timeEl) {
            endsAtRaw = timeEl.getAttribute("data-ends-at") 
              || timeEl.getAttribute("data-end-time")
              || timeEl.getAttribute("datetime") 
              || timeEl.textContent?.trim() 
              || undefined;
            break;
          }
        }

        const lotEndTimeAttr = containerEl.getAttribute("data-lot-end-time");
        if (!endsAtRaw && lotEndTimeAttr) {
          endsAtRaw = lotEndTimeAttr;
        }

        lots.push({
          id: lotId,
          title,
          currentBid: bid,
          url: link,
          category: "search",
          endsAt: endsAtRaw,
        });
      });

      return lots;
    });

    for (const item of items) {
      const parsedItem: AuctionItem = {
        ...item,
        endsAt: parseEndTimeString(item.endsAt as unknown as string | undefined),
      };
      if (!seenIds.has(parsedItem.id)) {
        seenIds.add(parsedItem.id);
        results.push(parsedItem);
      }
    }

    console.log(`Found ${items.length} items for: ${keyword}`);
  }

  await page.close();
  return results;
}

export async function scrapeAll(): Promise<AuctionItem[]> {
  return scrapeByKeywords();
}
