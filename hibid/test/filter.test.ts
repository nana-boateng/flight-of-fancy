import { describe, expect, test, beforeAll } from "bun:test";
import type { AuctionItem, FilterResult } from "../src/types";

// Set environment variables before importing config
const originalEnv = { ...process.env };

beforeAll(() => {
  process.env.MAX_BID_THRESHOLD = "100";
  process.env.KEYWORDS = "air fryer,ninja crispi";
});

// Import after setting env vars - this will use our mocked values
import { matchesKeyword, meetsPriceThreshold, filterItem, filterItems, filterByExpiringSoon } from "../src/filter";

describe("matchesKeyword", () => {
  test("should return true when title contains keyword (air fryer)", () => {
    const item: AuctionItem = {
      id: "1",
      title: "Ninja Air Fryer 4qt",
      currentBid: 50,
      url: "https://example.com/1",
      category: "Home",
    };
    expect(matchesKeyword(item)).toBe(true);
  });

  test("should return true when title contains keyword (ninja crispi)", () => {
    const item: AuctionItem = {
      id: "2",
      title: "Ninja Crispi Air Fryer XL",
      currentBid: 75,
      url: "https://example.com/2",
      category: "Home",
    };
    expect(matchesKeyword(item)).toBe(true);
  });

  test("should return true regardless of case", () => {
    const item: AuctionItem = {
      id: "3",
      title: "AIR FRYER PRO 2000",
      currentBid: 80,
      url: "https://example.com/3",
      category: "Home",
    };
    expect(matchesKeyword(item)).toBe(true);
  });

  test("should return false when title does not contain any keyword", () => {
    const item: AuctionItem = {
      id: "4",
      title: "Vintage Lamp",
      currentBid: 25,
      url: "https://example.com/4",
      category: "Home",
    };
    expect(matchesKeyword(item)).toBe(false);
  });

  test("should return true for partial keyword match", () => {
    const item: AuctionItem = {
      id: "5",
      title: "Air Fryer Basket Only",
      currentBid: 15,
      url: "https://example.com/5",
      category: "Home",
    };
    expect(matchesKeyword(item)).toBe(true);
  });
});

describe("meetsPriceThreshold", () => {
  test("should return true when bid is at or below threshold", () => {
    const item: AuctionItem = {
      id: "1",
      title: "Ninja Air Fryer",
      currentBid: 100,
      url: "https://example.com/1",
      category: "Home",
    };
    expect(meetsPriceThreshold(item)).toBe(true);
  });

  test("should return true when bid is below threshold", () => {
    const item: AuctionItem = {
      id: "2",
      title: "Ninja Crispi",
      currentBid: 50,
      url: "https://example.com/2",
      category: "Home",
    };
    expect(meetsPriceThreshold(item)).toBe(true);
  });

  test("should return false when bid exceeds threshold", () => {
    const item: AuctionItem = {
      id: "3",
      title: "Ninja Air Fryer",
      currentBid: 101,
      url: "https://example.com/3",
      category: "Home",
    };
    expect(meetsPriceThreshold(item)).toBe(false);
  });

  test("should return false when bid is significantly above threshold", () => {
    const item: AuctionItem = {
      id: "4",
      title: "Ninja Crispi Pro",
      currentBid: 500,
      url: "https://example.com/4",
      category: "Home",
    };
    expect(meetsPriceThreshold(item)).toBe(false);
  });
});

describe("filterItem", () => {
  test("should return matched: true when both keyword and price threshold pass", () => {
    const item: AuctionItem = {
      id: "1",
      title: "Ninja Air Fryer 4qt",
      currentBid: 75,
      url: "https://example.com/1",
      category: "Home",
    };
    const result = filterItem(item);
    expect(result.matched).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("should return matched: false with reason 'price' when price exceeds threshold", () => {
    const item: AuctionItem = {
      id: "2",
      title: "Ninja Air Fryer",
      currentBid: 150,
      url: "https://example.com/2",
      category: "Home",
    };
    const result = filterItem(item);
    expect(result.matched).toBe(false);
    expect(result.reason).toBe("price");
  });

  test("should return matched: false with reason 'keyword' when keyword does not match", () => {
    const item: AuctionItem = {
      id: "3",
      title: "Vintage Lamp",
      currentBid: 50,
      url: "https://example.com/3",
      category: "Home",
    };
    const result = filterItem(item);
    expect(result.matched).toBe(false);
    expect(result.reason).toBe("keyword");
  });

  test("should return matched: false with reason 'price' even if keyword matches but price too high", () => {
    const item: AuctionItem = {
      id: "4",
      title: "Air Fryer Pro",
      currentBid: 200,
      url: "https://example.com/4",
      category: "Home",
    };
    const result = filterItem(item);
    expect(result.matched).toBe(false);
    expect(result.reason).toBe("price");
  });

  test("should handle edge case with bid exactly at threshold", () => {
    const item: AuctionItem = {
      id: "5",
      title: "Ninja Crispi",
      currentBid: 100,
      url: "https://example.com/5",
      category: "Home",
    };
    const result = filterItem(item);
    expect(result.matched).toBe(true);
  });

  test("should handle bid of 0", () => {
    const item: AuctionItem = {
      id: "6",
      title: "Ninja Air Fryer",
      currentBid: 0,
      url: "https://example.com/6",
      category: "Home",
    };
    const result = filterItem(item);
    expect(result.matched).toBe(true);
  });
});

describe("filterItems", () => {
  test("should return all matching items from array", () => {
    const items: AuctionItem[] = [
      { id: "1", title: "Ninja Air Fryer", currentBid: 50, url: "https://example.com/1", category: "Home" },
      { id: "2", title: "Vintage Lamp", currentBid: 25, url: "https://example.com/2", category: "Home" },
      { id: "3", title: "Ninja Crispi", currentBid: 75, url: "https://example.com/3", category: "Home" },
      { id: "4", title: "Old Books", currentBid: 10, url: "https://example.com/4", category: "Books" },
    ];
    const result = filterItems(items);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(["1", "3"]);
  });

  test("should return empty array when no items match", () => {
    const items: AuctionItem[] = [
      { id: "1", title: "Vintage Lamp", currentBid: 50, url: "https://example.com/1", category: "Home" },
      { id: "2", title: "Old Books", currentBid: 25, url: "https://example.com/2", category: "Books" },
    ];
    const result = filterItems(items);
    expect(result).toHaveLength(0);
  });

  test("should return all items when all match", () => {
    const items: AuctionItem[] = [
      { id: "1", title: "Ninja Air Fryer", currentBid: 50, url: "https://example.com/1", category: "Home" },
      { id: "2", title: "Ninja Crispi Pro", currentBid: 100, url: "https://example.com/2", category: "Home" },
    ];
    const result = filterItems(items);
    expect(result).toHaveLength(2);
  });

  test("should filter out items exceeding price threshold", () => {
    const items: AuctionItem[] = [
      { id: "1", title: "Ninja Air Fryer", currentBid: 50, url: "https://example.com/1", category: "Home" },
      { id: "2", title: "Ninja Crispi", currentBid: 150, url: "https://example.com/2", category: "Home" },
      { id: "3", title: "Air Fryer XL", currentBid: 75, url: "https://example.com/3", category: "Home" },
    ];
    const result = filterItems(items);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(["1", "3"]);
  });

  test("should handle empty array", () => {
    const items: AuctionItem[] = [];
    const result = filterItems(items);
    expect(result).toHaveLength(0);
  });

  test("should preserve original item properties", () => {
    const items: AuctionItem[] = [
      { id: "1", title: "Ninja Air Fryer", currentBid: 50, url: "https://example.com/1", category: "Home" },
    ];
    const result = filterItems(items);
    expect(result[0]).toEqual(items[0]);
  });
});

describe("filterByExpiringSoon", () => {
  test("should return items expiring within default 30 minutes", () => {
    const now = new Date();
    const items: AuctionItem[] = [
      { id: "1", title: "Ninja Air Fryer", currentBid: 50, url: "https://example.com/1", category: "Home", endsAt: new Date(now.getTime() + 15 * 60 * 1000) },
      { id: "2", title: "Ninja Crispi", currentBid: 75, url: "https://example.com/2", category: "Home", endsAt: new Date(now.getTime() + 60 * 60 * 1000) },
    ];
    const result = filterByExpiringSoon(items);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  test("should return items expiring within custom minutes", () => {
    const now = new Date();
    const items: AuctionItem[] = [
      { id: "1", title: "Ninja Air Fryer", currentBid: 50, url: "https://example.com/1", category: "Home", endsAt: new Date(now.getTime() + 15 * 60 * 1000) },
      { id: "2", title: "Ninja Crispi", currentBid: 75, url: "https://example.com/2", category: "Home", endsAt: new Date(now.getTime() + 45 * 60 * 1000) },
      { id: "3", title: "Air Fryer Pro", currentBid: 100, url: "https://example.com/3", category: "Home", endsAt: new Date(now.getTime() + 120 * 60 * 1000) },
    ];
    const result = filterByExpiringSoon(items, 60);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(["1", "2"]);
  });

  test("should include items without endsAt", () => {
    const now = new Date();
    const items: AuctionItem[] = [
      { id: "1", title: "Ninja Air Fryer", currentBid: 50, url: "https://example.com/1", category: "Home", endsAt: new Date(now.getTime() + 15 * 60 * 1000) },
      { id: "2", title: "Ninja Crispi", currentBid: 75, url: "https://example.com/2", category: "Home" },
    ];
    const result = filterByExpiringSoon(items);
    expect(result).toHaveLength(2);
    expect(result.map((i) => i.id)).toEqual(["1", "2"]);
  });

  test("should include items without endsAt when all items have endsAt beyond threshold", () => {
    const now = new Date();
    const items: AuctionItem[] = [
      { id: "1", title: "Ninja Air Fryer", currentBid: 50, url: "https://example.com/1", category: "Home", endsAt: new Date(now.getTime() + 120 * 60 * 1000) },
      { id: "2", title: "Ninja Crispi", currentBid: 75, url: "https://example.com/2", category: "Home" },
    ];
    const result = filterByExpiringSoon(items, 30);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("2");
  });

  test("should include items already expired", () => {
    const now = new Date();
    const items: AuctionItem[] = [
      { id: "1", title: "Ninja Air Fryer", currentBid: 50, url: "https://example.com/1", category: "Home", endsAt: new Date(now.getTime() - 5 * 60 * 1000) },
    ];
    const result = filterByExpiringSoon(items);
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe("1");
  });

  test("should handle empty array", () => {
    const items: AuctionItem[] = [];
    const result = filterByExpiringSoon(items);
    expect(result).toHaveLength(0);
  });
});
