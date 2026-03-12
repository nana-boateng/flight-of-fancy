/**
 * Generic product URL resolver — works with Amazon, Best Buy, Walmart, etc.
 * Fetches page HTML, extracts title + price + brand/model metadata.
 * When auto-resolve fails (e.g. Amazon bot detection), degrades gracefully
 * with per-URL status so the frontend can prompt for manual entry.
 */

export interface ResolvedUrl {
  url: string;
  title: string | null;
  priceCents: number | null;
  brand: string | null;
  modelNumber: string | null;
  asin: string | null;
  status: 'ok' | 'partial' | 'failed';
  retailer: string | null;
}

export interface AnalysisResult {
  title: string;
  referencePriceCents: number | null;
  priceSource: 'auto' | 'manual';
  sourceUrls: string[];
  keywords: string[];
  urlDetails: ResolvedUrl[];
  needsManualInput: boolean;
}

/* ── retailer detection ── */

const RETAILER_PATTERNS: Array<{ pattern: RegExp; name: string }> = [
  { pattern: /amazon\.(ca|com|co\.uk|com\.au)/i, name: 'Amazon' },
  { pattern: /bestbuy\.(ca|com)/i, name: 'Best Buy' },
  { pattern: /walmart\.(ca|com)/i, name: 'Walmart' },
  { pattern: /costco\.(ca|com)/i, name: 'Costco' },
  { pattern: /canadiantire\.ca/i, name: 'Canadian Tire' },
  { pattern: /homedepot\.(ca|com)/i, name: 'Home Depot' },
  { pattern: /staples\.(ca|com)/i, name: 'Staples' },
  { pattern: /newegg\.(ca|com)/i, name: 'Newegg' },
  { pattern: /ebay\.(ca|com)/i, name: 'eBay' },
];

const RETAILER_SUFFIXES = [
  /\s*[-|:]\s*Amazon\.ca\s*$/i,
  /\s*[-|:]\s*Amazon\.com\s*$/i,
  /\s*[-|:]\s*Amazon\.[a-z.]+\s*$/i,
  /\s*[-|:]\s*Best Buy Canada?\s*$/i,
  /\s*[-|:]\s*Best Buy\s*$/i,
  /\s*[-|:]\s*Walmart\.ca\s*$/i,
  /\s*[-|:]\s*Walmart\.com\s*$/i,
  /\s*[-|:]\s*Walmart\s*$/i,
  /\s*[-|:]\s*Costco\s*$/i,
  /\s*[-|:]\s*Canadian Tire\s*$/i,
  /\s*[-|:]\s*Home Depot\s*$/i,
  /\s*[-|:]\s*Staples\s*$/i,
  /\s*[-|:]\s*Newegg\.ca\s*$/i,
  /\s*[-|:]\s*Newegg\s*$/i,
  /\s*[-|:]\s*eBay\s*$/i,
];

// Bare retailer names that indicate the fetch returned nothing useful
const GARBAGE_TITLES = [
  /^amazon\.?/i,
  /^best buy\.?/i,
  /^walmart\.?/i,
  /^costco\.?/i,
  /^ebay\.?/i,
  /^home depot\.?/i,
  /^staples\.?/i,
  /^canadian tire\.?/i,
  /^newegg\.?/i,
  /^page not found/i,
  /^error/i,
  /^robot check/i,
  /^access denied/i,
  /^sorry!/i,
  /^sign in/i,
];

/* ── keyword extraction constants ── */

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'for', 'of', 'to', 'in', 'on', 'at', 'by',
  'is', 'it', 'its', 'this', 'that', 'with', 'from', 'as', 'are', 'was',
  'be', 'has', 'had', 'have', 'do', 'does', 'did', 'but', 'not', 'so',
  'if', 'no', 'yes', 'all', 'each', 'every', 'both', 'few', 'more', 'most',
  'new', 'old', 'our', 'out', 'own', 'up', 'very',
]);

const SPEC_PATTERNS = [
  /^\d+(\.\d+)?\s*(mm|cm|m|in|inch|inches|ft|feet|oz|lb|lbs|kg|g|ml|l|w|watt|watts|v|volt|volts|amp|amps|hz|mhz|ghz|tb|gb|mb|kb|qt|quart|gal|gallon|btu|rpm)$/i,
  /^\d+["']$/,
  /^\d+x\d+(x\d+)?$/i,
  /^#[0-9a-f]{3,8}$/i,
  /^\d+(\.\d+)?["']\s*(w|h|d|l)$/i,
];

const COLOR_WORDS = new Set([
  'black', 'white', 'silver', 'grey', 'gray', 'red', 'blue', 'green',
  'gold', 'pink', 'purple', 'orange', 'brown', 'beige', 'navy', 'teal',
  'ivory', 'charcoal', 'stainless', 'chrome', 'matte', 'graphite',
  'midnight', 'space', 'starlight',
]);

const FILLER_WORDS = new Set([
  'pack', 'piece', 'set', 'count', 'bundle', 'combo', 'kit',
  'size', 'large', 'small', 'medium', 'xl', 'xxl', 'xs',
  'best', 'seller', 'choice', 'deal', 'sale', 'limited', 'edition',
  'free', 'shipping', 'delivery', 'returns', 'warranty',
  'renewed', 'refurbished', 'certified', 'pre-owned',
  'model', 'version', 'generation', 'gen', 'series',
]);

/* ── helpers ── */

function validateUrl(raw: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('URL must use http or https');
  }

  return parsed;
}

function detectRetailer(hostname: string): string | null {
  for (const entry of RETAILER_PATTERNS) {
    if (entry.pattern.test(hostname)) {
      return entry.name;
    }
  }
  return null;
}

function isAmazonHost(hostname: string): boolean {
  return /amazon\.(ca|com|co\.uk|com\.au)/i.test(hostname);
}

export function extractAsinFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
    return match?.[1]?.toUpperCase() ?? null;
  } catch {
    return null;
  }
}

export function isValidAsin(value: string): boolean {
  return /^[A-Z0-9]{10}$/i.test(value.trim());
}

function cleanTitle(rawTitle: string): string {
  let title = rawTitle.trim();
  for (const suffix of RETAILER_SUFFIXES) {
    title = title.replace(suffix, '');
  }
  return title
    .replace(/\s+/g, ' ')
    .replace(/^[^a-zA-Z0-9]+/, '')
    .trim();
}

function isGarbageTitle(title: string): boolean {
  const trimmed = title.trim();
  if (trimmed.length < 3) return true;
  return GARBAGE_TITLES.some((pattern) => pattern.test(trimmed));
}

function extractTitleFromHtml(html: string): string | null {
  const ogTitle = html.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]+)"/is);
  if (ogTitle?.[1]) {
    const cleaned = cleanTitle(ogTitle[1]);
    if (!isGarbageTitle(cleaned)) return cleaned;
  }

  const titleTag = html.match(/<title[^>]*>(.*?)<\/title>/is);
  if (titleTag?.[1]) {
    const cleaned = cleanTitle(titleTag[1]);
    if (!isGarbageTitle(cleaned)) return cleaned;
  }

  return null;
}

function extractPriceFromHtml(html: string): number | null {
  const jsonLdBlocks = html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1] ?? '');
      const price =
        data?.offers?.price ??
        data?.offers?.[0]?.price ??
        data?.offers?.lowPrice ??
        null;
      if (price !== null && price !== undefined) {
        const dollars = Number(price);
        if (Number.isFinite(dollars) && dollars > 0) {
          return Math.round(dollars * 100);
        }
      }
    } catch {
      continue;
    }
  }

  const metaPrice = html.match(/<meta\s+(?:property|itemprop)\s*=\s*"(?:og:price:amount|price)"\s+content\s*=\s*"([^"]+)"/i);
  if (metaPrice?.[1]) {
    const dollars = Number(metaPrice[1]);
    if (Number.isFinite(dollars) && dollars > 0) {
      return Math.round(dollars * 100);
    }
  }

  const pricePatterns = [
    /"priceToPay"\s*:\s*\{[^}]*"rawPrice"\s*:\s*"([0-9]+(?:\.[0-9]{1,2})?)"/i,
    /"displayPrice"\s*:\s*"\$?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)"/i,
    /id="priceblock_ourprice"[^>]*>\s*\$?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /class="a-offscreen">\s*\$?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*</i,
    /class="[^"]*price[^"]*"[^>]*>\s*\$?([0-9]+(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)/i,
    /data-price="([0-9]+(?:\.[0-9]{1,2})?)"/i,
  ];

  for (const pattern of pricePatterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const dollars = Number(match[1].replaceAll(',', ''));
    if (Number.isFinite(dollars) && dollars > 0) {
      return Math.round(dollars * 100);
    }
  }

  return null;
}

function extractBrandFromHtml(html: string): string | null {
  const jsonLdBlocks = html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis);
  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1] ?? '');
      const brand = data?.brand?.name ?? data?.brand ?? null;
      if (typeof brand === 'string' && brand.trim()) {
        return brand.trim();
      }
    } catch {
      continue;
    }
  }

  const metaBrand = html.match(/<meta\s+(?:property|name)\s*=\s*"(?:og:brand|product:brand)"\s+content\s*=\s*"([^"]+)"/i);
  if (metaBrand?.[1]) {
    return metaBrand[1].trim();
  }

  const byBrand = html.match(/(?:by|Brand[:\s]+)\s*<a[^>]*>([^<]+)<\/a>/i);
  if (byBrand?.[1]) {
    return byBrand[1].trim();
  }

  return null;
}

function extractModelFromTitle(title: string): string | null {
  const modelPatterns = [
    /\b([A-Z]{1,4}\d{2,}[A-Z0-9-]*)\b/,
    /\b([A-Z]{2,}-[A-Z0-9]+)\b/,
    /\b(\d{3,}[A-Z]{1,3}[A-Z0-9-]*)\b/,
  ];

  for (const pattern of modelPatterns) {
    const match = title.match(pattern);
    if (match?.[1] && match[1].length >= 3 && match[1].length <= 20) {
      return match[1];
    }
  }

  return null;
}

/* ── URL resolution ── */

export async function resolveUrl(rawUrl: string): Promise<ResolvedUrl> {
  const parsed = validateUrl(rawUrl);
  const hostname = parsed.hostname.toLowerCase();
  const retailer = detectRetailer(hostname);
  const asin = isAmazonHost(hostname) ? extractAsinFromUrl(rawUrl) : null;

  // Build a canonical URL for Amazon if we have an ASIN
  const canonical = asin
    ? `${parsed.protocol}//${parsed.hostname}/dp/${asin}`
    : parsed.toString();

  try {
    const response = await fetch(canonical, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en-US;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      return {
        url: canonical,
        title: null,
        priceCents: null,
        brand: null,
        modelNumber: null,
        asin,
        status: 'failed',
        retailer,
      };
    }

    const html = await response.text();
    const title = extractTitleFromHtml(html);
    const priceCents = extractPriceFromHtml(html);
    const brand = extractBrandFromHtml(html);
    const modelNumber = title ? extractModelFromTitle(title) : null;

    // Determine resolution quality
    const hasTitle = title !== null;
    const hasPrice = priceCents !== null;
    let status: 'ok' | 'partial' | 'failed';

    if (hasTitle && hasPrice) {
      status = 'ok';
    } else if (hasTitle || hasPrice) {
      status = 'partial';
    } else {
      status = 'failed';
    }

    return { url: canonical, title, priceCents, brand, modelNumber, asin, status, retailer };
  } catch {
    return {
      url: canonical,
      title: null,
      priceCents: null,
      brand: null,
      modelNumber: null,
      asin,
      status: 'failed',
      retailer,
    };
  }
}

/* ── keyword extraction ── */

function isSpecToken(token: string): boolean {
  return SPEC_PATTERNS.some((pattern) => pattern.test(token));
}

function isUsefulToken(token: string): boolean {
  const lowered = token.toLowerCase();
  if (lowered.length < 2) return false;
  if (STOP_WORDS.has(lowered)) return false;
  if (COLOR_WORDS.has(lowered)) return false;
  if (FILLER_WORDS.has(lowered)) return false;
  if (isSpecToken(token)) return false;
  if (/^\d+$/.test(token)) return false;
  return true;
}

function tokenize(title: string): string[] {
  return title
    .replace(/[()[\]{}"']/g, ' ')
    .replace(/[,;|\/\\]/g, ' ')
    .split(/\s+/)
    .map((token) => token.replace(/^[-–—]+|[-–—]+$/g, ''))
    .filter((token) => token.length > 0);
}

function intersectTokenSets(sets: string[][]): string[] {
  if (sets.length === 0) return [];
  if (sets.length === 1) return sets[0] ?? [];

  const loweredSets = sets.map((set) => set.map((token) => token.toLowerCase()));
  const firstSet = loweredSets[0];
  if (!firstSet) return [];

  return firstSet.filter((token) =>
    loweredSets.every((set) => set.includes(token)),
  );
}

export function generateKeywords(resolved: ResolvedUrl[]): string[] {
  const keywords: string[] = [];
  const seen = new Set<string>();

  const addKeyword = (kw: string): void => {
    const lowered = kw.toLowerCase().trim();
    if (lowered.length < 2 || seen.has(lowered)) return;
    seen.add(lowered);
    keywords.push(lowered);
  };

  const brands = resolved
    .map((entry) => entry.brand)
    .filter((brand): brand is string => brand !== null);
  const models = resolved
    .map((entry) => entry.modelNumber)
    .filter((model): model is string => model !== null);

  const uniqueBrand = brands.length > 0 ? brands[0]! : null;
  const uniqueModel = models.length > 0 ? models[0]! : null;

  if (uniqueModel) {
    addKeyword(uniqueModel);
  }

  if (uniqueBrand && uniqueModel) {
    addKeyword(`${uniqueBrand} ${uniqueModel}`);
  }

  const tokenSets = resolved
    .map((entry) => entry.title)
    .filter((title): title is string => title !== null)
    .map((title) => tokenize(title).filter(isUsefulToken));

  if (tokenSets.length > 1) {
    const common = intersectTokenSets(tokenSets);
    if (common.length >= 2) {
      addKeyword(common.join(' '));
    }
    if (uniqueBrand) {
      const withoutBrand = common.filter(
        (token) => token.toLowerCase() !== uniqueBrand.toLowerCase(),
      );
      if (withoutBrand.length >= 1) {
        addKeyword(`${uniqueBrand} ${withoutBrand.join(' ')}`);
      }
    }
  }

  for (const entry of resolved) {
    if (!entry.title) continue;
    const useful = tokenize(entry.title).filter(isUsefulToken);

    if (uniqueBrand) {
      const productType = useful.filter(
        (token) => token.toLowerCase() !== uniqueBrand.toLowerCase(),
      );
      if (productType.length >= 1) {
        const phrase = `${uniqueBrand} ${productType.slice(0, 3).join(' ')}`;
        addKeyword(phrase);
      }
    }

    if (useful.length >= 2) {
      addKeyword(useful.slice(0, 4).join(' '));
    }
  }

  if (uniqueBrand && keywords.length === 0) {
    addKeyword(uniqueBrand);
  }

  return keywords;
}

/* ── main analysis entry point ── */

export async function analyzeUrls(input: {
  urls: string[];
  manualAsin: string | null;
  manualTitle: string | null;
  manualReferencePriceDollars: number | null;
}): Promise<AnalysisResult> {
  if (input.urls.length === 0 && !input.manualAsin) {
    throw new Error('At least one URL or an ASIN is required');
  }

  // If user provided a manual ASIN without an Amazon URL, create one
  const urls = [...input.urls];
  if (input.manualAsin && isValidAsin(input.manualAsin)) {
    const asin = input.manualAsin.trim().toUpperCase();
    const alreadyHasAmazon = urls.some((url) => extractAsinFromUrl(url) === asin);
    if (!alreadyHasAmazon) {
      urls.push(`https://www.amazon.ca/dp/${asin}`);
    }
  }

  const resolved = await Promise.all(
    urls.map((url) => resolveUrl(url)),
  );

  const keywords = generateKeywords(resolved);

  const titles = resolved
    .map((entry) => entry.title)
    .filter((title): title is string => title !== null);
  const autoTitle = titles[0] ?? null;

  const prices = resolved
    .map((entry) => entry.priceCents)
    .filter((price): price is number => price !== null && price > 0)
    .sort((a, b) => a - b);

  let referencePriceCents: number | null = null;
  let priceSource: 'auto' | 'manual' = 'auto';

  if (prices.length > 0) {
    const mid = Math.floor(prices.length / 2);
    referencePriceCents =
      prices.length % 2 === 0
        ? Math.round(((prices[mid - 1] ?? 0) + (prices[mid] ?? 0)) / 2)
        : (prices[mid] ?? null);
  }

  if (
    input.manualReferencePriceDollars !== null &&
    Number.isFinite(input.manualReferencePriceDollars) &&
    input.manualReferencePriceDollars > 0
  ) {
    referencePriceCents = Math.round(input.manualReferencePriceDollars * 100);
    priceSource = 'manual';
  }

  const anyFailed = resolved.some((entry) => entry.status === 'failed');
  const anyPartial = resolved.some((entry) => entry.status === 'partial');
  const noKeywords = keywords.length === 0;
  const noTitle = autoTitle === null && !input.manualTitle;
  const noPrice = referencePriceCents === null;

  const needsManualInput = anyFailed || anyPartial || noKeywords || noTitle || noPrice;

  return {
    title: input.manualTitle?.trim() || autoTitle || '',
    referencePriceCents,
    priceSource,
    sourceUrls: resolved.map((entry) => entry.url),
    keywords,
    urlDetails: resolved,
    needsManualInput,
  };
}
