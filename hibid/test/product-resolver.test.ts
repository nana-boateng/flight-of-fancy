import { describe, expect, test } from 'bun:test';
import {
  generateKeywords,
  extractAsinFromUrl,
  isValidAsin,
} from '../src/product-resolver';
import type { ResolvedUrl } from '../src/product-resolver';

describe('extractAsinFromUrl', () => {
  test('extracts ASIN from /dp/ URL', () => {
    expect(extractAsinFromUrl('https://www.amazon.ca/dp/B09V3KXJPB')).toBe('B09V3KXJPB');
  });

  test('extracts ASIN from /gp/product/ URL', () => {
    expect(extractAsinFromUrl('https://www.amazon.com/gp/product/B09V3KXJPB/ref=foo')).toBe(
      'B09V3KXJPB',
    );
  });

  test('returns null for non-Amazon URL', () => {
    expect(extractAsinFromUrl('https://www.bestbuy.ca/product/123')).toBeNull();
  });

  test('returns null for invalid URL', () => {
    expect(extractAsinFromUrl('not-a-url')).toBeNull();
  });
});

describe('isValidAsin', () => {
  test('accepts valid ASINs', () => {
    expect(isValidAsin('B09V3KXJPB')).toBe(true);
    expect(isValidAsin('0123456789')).toBe(true);
  });

  test('rejects invalid ASINs', () => {
    expect(isValidAsin('B09')).toBe(false);
    expect(isValidAsin('B09V3KXJPB-extra')).toBe(false);
    expect(isValidAsin('')).toBe(false);
  });
});

describe('generateKeywords', () => {
  test('extracts brand + model from a single URL', () => {
    const resolved: ResolvedUrl[] = [
      {
        url: 'https://amazon.ca/dp/B09V3KXJPB',
        title: 'Ninja AF101 Air Fryer 4 Qt Black',
        priceCents: 8999,
        brand: 'Ninja',
        modelNumber: 'AF101',
        asin: 'B09V3KXJPB',
        status: 'ok',
        retailer: 'Amazon',
      },
    ];

    const keywords = generateKeywords(resolved);

    expect(keywords.some((kw) => kw.includes('af101'))).toBe(true);
    expect(keywords.some((kw) => kw.includes('ninja'))).toBe(true);
  });

  test('intersects tokens from multiple URLs', () => {
    const resolved: ResolvedUrl[] = [
      {
        url: 'https://amazon.ca/dp/B09V3KXJPB',
        title: 'Ninja AF101 Air Fryer 4 Qt Black',
        priceCents: 8999,
        brand: 'Ninja',
        modelNumber: 'AF101',
        asin: 'B09V3KXJPB',
        status: 'ok',
        retailer: 'Amazon',
      },
      {
        url: 'https://www.bestbuy.ca/en-ca/product/ninja-af101-air-fryer',
        title: 'Ninja AF101 Air Fryer',
        priceCents: 9999,
        brand: 'Ninja',
        modelNumber: 'AF101',
        asin: null,
        status: 'ok',
        retailer: 'Best Buy',
      },
    ];

    const keywords = generateKeywords(resolved);

    expect(keywords.some((kw) => kw.includes('af101'))).toBe(true);
    expect(keywords.some((kw) => kw.includes('ninja'))).toBe(true);
    expect(keywords.some((kw) => kw.includes('fryer'))).toBe(true);
    expect(keywords.some((kw) => kw.includes('black'))).toBe(false);
  });

  test('filters out color words and specs', () => {
    const resolved: ResolvedUrl[] = [
      {
        url: 'https://example.com/product',
        title: 'Samsung Galaxy S24 Ultra 256GB Titanium Black 6.8"',
        priceCents: 149999,
        brand: 'Samsung',
        modelNumber: 'S24',
        asin: null,
        status: 'ok',
        retailer: null,
      },
    ];

    const keywords = generateKeywords(resolved);

    expect(keywords.some((kw) => kw.includes('black'))).toBe(false);
    expect(keywords.some((kw) => kw.includes('samsung'))).toBe(true);
  });

  test('handles missing brand gracefully', () => {
    const resolved: ResolvedUrl[] = [
      {
        url: 'https://example.com/product',
        title: 'Portable Bluetooth Speaker Waterproof',
        priceCents: 4999,
        brand: null,
        modelNumber: null,
        asin: null,
        status: 'ok',
        retailer: null,
      },
    ];

    const keywords = generateKeywords(resolved);

    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords.some((kw) => kw.includes('bluetooth'))).toBe(true);
    expect(keywords.some((kw) => kw.includes('speaker'))).toBe(true);
  });

  test('handles all null titles', () => {
    const resolved: ResolvedUrl[] = [
      {
        url: 'https://example.com/product',
        title: null,
        priceCents: null,
        brand: null,
        modelNumber: null,
        asin: null,
        status: 'failed',
        retailer: null,
      },
    ];

    const keywords = generateKeywords(resolved);
    expect(keywords.length).toBe(0);
  });

  test('skips failed URLs for keyword generation but uses ok ones', () => {
    const resolved: ResolvedUrl[] = [
      {
        url: 'https://www.amazon.ca/dp/B09V3KXJPB',
        title: null,
        priceCents: null,
        brand: null,
        modelNumber: null,
        asin: 'B09V3KXJPB',
        status: 'failed',
        retailer: 'Amazon',
      },
      {
        url: 'https://www.bestbuy.ca/en-ca/product/ninja-af101',
        title: 'Ninja AF101 Air Fryer',
        priceCents: 9999,
        brand: 'Ninja',
        modelNumber: 'AF101',
        asin: null,
        status: 'ok',
        retailer: 'Best Buy',
      },
    ];

    const keywords = generateKeywords(resolved);

    expect(keywords.some((kw) => kw.includes('af101'))).toBe(true);
    expect(keywords.some((kw) => kw.includes('ninja'))).toBe(true);
  });
});
