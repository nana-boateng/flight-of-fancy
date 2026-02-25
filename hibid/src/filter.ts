import { config } from "./config";
import type { AuctionItem, FilterResult } from "./types";

export function matchesKeyword(item: AuctionItem): boolean {
  const titleLower = item.title.toLowerCase();
  return config.keywords.some((keyword) =>
    titleLower.includes(keyword.toLowerCase())
  );
}

export function meetsPriceThreshold(item: AuctionItem): boolean {
  return item.currentBid <= config.scraper.maxBidThreshold;
}

export function filterItem(item: AuctionItem): FilterResult {
  if (!meetsPriceThreshold(item)) {
    return { matched: false, reason: "price" };
  }
  if (!matchesKeyword(item)) {
    return { matched: false, reason: "keyword" };
  }
  return { matched: true };
}

export function filterItems(items: AuctionItem[]): AuctionItem[] {
  return items.filter((item) => filterItem(item).matched);
}

export function filterByExpiringSoon(items: AuctionItem[], minutes: number = 30): AuctionItem[] {
  const now = Date.now();
  const thresholdMs = minutes * 60 * 1000;
  return items.filter((item) => {
    if (!item.endsAt) return true;
    const endsAtMs = item.endsAt.getTime();
    return endsAtMs - now <= thresholdMs;
  });
}
