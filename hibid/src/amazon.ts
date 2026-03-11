export interface ResolvedAmazonProduct {
  amazonUrl: string;
  asin: string | null;
  title: string;
  referencePriceCents: number | null;
  priceSource: 'auto' | 'manual';
}

function normalizeAmazonUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Amazon URL must use https');
  }

  const host = parsed.hostname.toLowerCase();
  const isAmazonHost =
    host === 'amazon.com' ||
    host.endsWith('.amazon.com') ||
    host === 'amazon.ca' ||
    host.endsWith('.amazon.ca') ||
    host === 'amazon.co.uk' ||
    host.endsWith('.amazon.co.uk');

  if (!isAmazonHost) {
    throw new Error('URL must be an Amazon product URL');
  }

  return parsed;
}

function extractAsin(pathname: string): string | null {
  const match = pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return match?.[1]?.toUpperCase() ?? null;
}

function parsePriceFromHtml(html: string): number | null {
  const patterns = [
    /"priceToPay"\s*:\s*\{[^}]*"rawPrice"\s*:\s*"([0-9]+(?:\.[0-9]{1,2})?)"/i,
    /"displayPrice"\s*:\s*"\$?([0-9]+(?:\.[0-9]{1,2})?)"/i,
    /id="priceblock_ourprice"[^>]*>\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/i,
    /id="priceblock_dealprice"[^>]*>\s*\$?([0-9]+(?:\.[0-9]{1,2})?)/i,
    /class="a-offscreen">\s*\$?([0-9]+(?:\.[0-9]{1,2})?)\s*</i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) {
      continue;
    }
    const dollars = Number(match[1]);
    if (Number.isFinite(dollars) && dollars > 0) {
      return Math.round(dollars * 100);
    }
  }

  return null;
}

function parseTitleFromHtml(html: string): string | null {
  const titleMatch = html.match(/<title>(.*?)<\/title>/is);
  if (!titleMatch?.[1]) {
    return null;
  }

  return titleMatch[1]
    .replace(/\s+-\s+Amazon\.ca\s*$/i, '')
    .replace(/\s+-\s+Amazon\.com\s*$/i, '')
    .trim();
}

export async function resolveAmazonProduct(input: {
  amazonUrl: string;
  manualReferencePrice: number | null;
  manualTitle: string | null;
}): Promise<ResolvedAmazonProduct> {
  const parsed = normalizeAmazonUrl(input.amazonUrl);
  const asin = extractAsin(parsed.pathname);
  const canonicalUrl = asin
    ? `${parsed.protocol}//${parsed.hostname}/dp/${asin}`
    : parsed.toString();

  const manualCents =
    input.manualReferencePrice !== null && Number.isFinite(input.manualReferencePrice)
      ? Math.round(input.manualReferencePrice * 100)
      : null;

  try {
    const response = await fetch(canonicalUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-CA,en-US;q=0.9,en;q=0.8',
      },
    });

    if (!response.ok) {
      if (manualCents === null) {
        throw new Error(`Amazon fetch failed (${response.status}) and no manual price was supplied`);
      }

      return {
        amazonUrl: canonicalUrl,
        asin,
        title: input.manualTitle?.trim() || `Amazon product ${asin ?? ''}`.trim(),
        referencePriceCents: manualCents,
        priceSource: 'manual',
      };
    }

    const html = await response.text();
    const autoPrice = parsePriceFromHtml(html);
    const autoTitle = parseTitleFromHtml(html);

    if (autoPrice !== null) {
      return {
        amazonUrl: canonicalUrl,
        asin,
        title: input.manualTitle?.trim() || autoTitle || `Amazon product ${asin ?? ''}`.trim(),
        referencePriceCents: autoPrice,
        priceSource: 'auto',
      };
    }
  } catch (error) {
    if (manualCents === null) {
      throw error;
    }
  }

  if (manualCents !== null) {
    return {
      amazonUrl: canonicalUrl,
      asin,
      title: input.manualTitle?.trim() || `Amazon product ${asin ?? ''}`.trim(),
      referencePriceCents: manualCents,
      priceSource: 'manual',
    };
  }

  throw new Error('Could not resolve Amazon price automatically. Provide a manual reference price.');
}
