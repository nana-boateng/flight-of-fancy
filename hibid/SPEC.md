# SPEC.md - HiBid Auction Scraper

## Purpose

Scrape **ontario.hibid.com** (and/or **www.hibid.com** filtered to Ontario) for
auction listings that match configurable keyword and price criteria. When matches
are found, send push notifications via **ntfy**. The scraper runs on a
configurable interval.

---

## Target Site

| URL | Notes |
| --- | --- |
| `https://ontario.hibid.com` | Primary; Ontario-specific subdomain |
| `https://www.hibid.com` | Fallback; apply Ontario location filter |

HiBid renders auction data client-side (React/JS). Pages require JavaScript
execution to populate listings. **Puppeteer** (already installed) will be used
as the headless browser.

---

## Categories

The scraper monitors the following HiBid categories:

1. Home & Garden
2. Electronics
3. Tools & Equipment
4. Sports & Fitness

Each category corresponds to a navigable section or filter on the HiBid site.
Category URLs/selectors will be maintained in configuration so they can be
updated without code changes.

---

## Filters

A listing is considered a **match** when it satisfies **all** of the following:

| Filter | Condition |
| --- | --- |
| **Current bid** | Less than `$100` (configurable via `MAX_BID`) |
| **Keywords** | Title or description contains at least one keyword from the configured list |

### Default Keywords

```
air fryer, ninja crispi
```

Keywords are matched case-insensitively. Partial word matches are accepted
(e.g. "crispi" matches "Ninja Crispi Air Fryer 6-Qt").

---

## Module Breakdown

```
src/
  config.ts        # Environment variable loading and validation
  types.ts         # Shared type definitions
  scraper.ts       # Puppeteer-based page scraping
  filter.ts        # Bid price and keyword filtering logic
  notify.ts        # ntfy push notification client
  scheduler.ts     # Interval-based execution loop
index.ts           # Entry point; wires modules together
```

### `src/config.ts`

Loads and validates all configuration from environment variables. Exports a
single typed `Config` object. Fails fast with descriptive errors on missing
required values.

```ts
interface Config {
  /** Base URL to scrape (default: "https://ontario.hibid.com") */
  baseUrl: string;
  /** HiBid categories to monitor */
  categories: string[];
  /** Maximum current bid in dollars (default: 100) */
  maxBid: number;
  /** Comma-separated keywords to match (default: "air fryer,ninja crispi") */
  keywords: string[];
  /** ntfy server URL (default: "https://ntfy.sh") */
  ntfyServer: string;
  /** ntfy topic name (required) */
  ntfyTopic: string;
  /** ntfy auth token (optional; for private topics) */
  ntfyToken: string | undefined;
  /** Scrape interval in minutes (default: 30) */
  intervalMinutes: number;
  /** Run once and exit instead of looping (default: false) */
  runOnce: boolean;
  /** Puppeteer headless mode (default: true) */
  headless: boolean;
}
```

### `src/types.ts`

Shared data structures used across modules.

```ts
/** A single auction listing scraped from HiBid. */
interface AuctionItem {
  /** Unique lot/item ID from HiBid */
  id: string;
  /** Item title */
  title: string;
  /** Item description (may be empty if not loaded) */
  description: string;
  /** Current highest bid in dollars; null if no bids yet */
  currentBid: number | null;
  /** Category the item was found under */
  category: string;
  /** Auction house name */
  auctionHouse: string;
  /** Auction end date/time (ISO 8601) */
  endDate: string;
  /** Direct URL to the item on HiBid */
  url: string;
  /** URL to the item's thumbnail image (optional) */
  imageUrl: string | undefined;
}

/** Result of a single scrape cycle. */
interface ScrapeResult {
  /** All items scraped (before filtering) */
  totalScraped: number;
  /** Items that passed filters */
  matches: AuctionItem[];
  /** Errors encountered (non-fatal) */
  errors: string[];
  /** Timestamp of the scrape (ISO 8601) */
  timestamp: string;
}
```

### `src/scraper.ts`

Responsible for launching Puppeteer, navigating to each category page, and
extracting `AuctionItem[]` from the DOM.

**Exported function:**

```ts
function scrapeCategory(browser: Browser, config: Config, category: string): Promise<AuctionItem[]>
```

**Approach:**

1. Launch a single `Browser` instance per scrape cycle (reused across
   categories).
2. For each category, open a new `Page`, navigate to the category URL, and wait
   for auction item elements to render.
3. Use `page.$$eval()` to extract item data from DOM nodes (title, bid, URL,
   etc.).
4. Handle pagination if the category has multiple pages of results.
5. Close each page after extraction; close the browser after all categories are
   done.

**DOM interaction notes:**

- Wait for a known selector (e.g. `.lot-tile`, `.auction-item`, or similar) with
  a timeout. If the selector never appears, return an empty array and log a
  warning (the site layout may have changed).
- Extract bid amounts by parsing text content and stripping `$` / `,`
  characters.
- Items with no bids should set `currentBid` to `null`.

### `src/filter.ts`

Pure functions that take `AuctionItem[]` and `Config` and return matched items.

```ts
function filterItems(items: AuctionItem[], config: Config): AuctionItem[]
```

**Filter logic:**

1. **Bid filter**: Keep items where `currentBid` is `null` (no bids yet) OR
   `currentBid < config.maxBid`.
2. **Keyword filter**: Keep items where `title` or `description` includes at
   least one keyword (case-insensitive substring match).
3. Both filters must pass (AND logic).

### `src/notify.ts`

Sends push notifications via the [ntfy](https://ntfy.sh) HTTP API.

```ts
function notifyMatches(matches: AuctionItem[], config: Config): Promise<void>
```

**Behavior:**

- Send one notification per matched item (to avoid message size limits).
- Each notification includes: item title, current bid, auction end date, and a
  direct link (click action).
- Use ntfy message priority `3` (default) for normal matches; priority `4`
  (high) if the item has zero bids.
- Respect ntfy rate limits; add a small delay between messages if sending more
  than 5.
- If `ntfyToken` is set, include it as a `Bearer` token in the `Authorization`
  header.

**HTTP request (per item):**

```
POST {ntfyServer}/{ntfyTopic}
Headers:
  Title: HiBid Match: {item.title}
  Priority: 3
  Tags: auction,deal
  Click: {item.url}
  Authorization: Bearer {ntfyToken}  (if set)
Body:
  {item.title}
  Bid: ${item.currentBid ?? "No bids"} | Ends: {item.endDate}
  {item.url}
```

Uses `fetch()` (built into Bun) -- no additional HTTP library needed.

### `src/scheduler.ts`

Manages the recurring execution loop.

```ts
function startScheduler(config: Config): void
```

**Behavior:**

- Run an initial scrape immediately on startup.
- Then repeat every `config.intervalMinutes` minutes using `setInterval`.
- If `config.runOnce` is `true`, run once and exit (useful for cron-based
  scheduling).
- Track previously notified item IDs (in-memory `Set<string>`) to avoid sending
  duplicate notifications for the same item across cycles.
- Log the start and end of each cycle with duration and match count.

### `index.ts`

Entry point. Loads config, validates it, and starts the scheduler.

```ts
import { loadConfig } from './src/config';
import { startScheduler } from './src/scheduler';

const config = loadConfig();
startScheduler(config);
```

---

## Environment Variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `HIBID_BASE_URL` | No | `https://ontario.hibid.com` | Base URL to scrape |
| `HIBID_CATEGORIES` | No | `Home & Garden,Electronics,Tools & Equipment,Sports & Fitness` | Comma-separated category names |
| `HIBID_MAX_BID` | No | `100` | Maximum bid price filter (dollars) |
| `HIBID_KEYWORDS` | No | `air fryer,ninja crispi` | Comma-separated keywords |
| `NTFY_SERVER` | No | `https://ntfy.sh` | ntfy server URL |
| `NTFY_TOPIC` | **Yes** | -- | ntfy topic to publish to |
| `NTFY_TOKEN` | No | -- | ntfy auth token for private topics |
| `HIBID_INTERVAL_MINUTES` | No | `30` | Minutes between scrape cycles |
| `HIBID_RUN_ONCE` | No | `false` | Run once and exit (`true`/`false`) |
| `HIBID_HEADLESS` | No | `true` | Run Puppeteer in headless mode |

---

## Error Handling Approach

### Principles

- **Never silently swallow errors.** Every caught error is logged with context.
- **Non-fatal errors do not crash the loop.** A single category failing does not
  prevent other categories from being scraped.
- **Fatal errors exit the process.** Missing required config (`NTFY_TOPIC`) or
  Puppeteer failing to launch causes an immediate exit with a non-zero code.

### Specific Scenarios

| Scenario | Handling |
| --- | --- |
| Missing required env var | Throw on startup with message naming the variable |
| Puppeteer fails to launch | Log error, exit process with code 1 |
| Page navigation timeout | Log warning, skip category, continue to next |
| DOM selector not found | Log warning (possible site layout change), return empty array |
| Bid price parse failure | Log warning, treat as `null` (no bid), still include item |
| ntfy request fails | Log error with HTTP status, do not retry (will catch on next cycle) |
| Unexpected exception in cycle | Catch at scheduler level, log full error, continue to next cycle |

### Logging

Use `console.info` / `console.warn` / `console.error` with timestamps and
context prefixes (e.g. `[scraper]`, `[notify]`, `[scheduler]`). No external
logging library needed.

---

## Scraping Approach

### Why Puppeteer (Headless Browser)

HiBid is a JavaScript-heavy single-page application. Auction listings are
rendered client-side after API calls complete. A simple HTTP fetch of the HTML
returns an empty shell. Puppeteer is required to:

1. Execute JavaScript and wait for the DOM to populate.
2. Handle any client-side routing or lazy-loaded content.
3. Interact with pagination controls if needed.

### Performance Considerations

- Reuse a single browser instance across all categories in one cycle.
- Use `page.setRequestInterception(true)` to block images, fonts, and
  stylesheets -- speeds up page loads significantly.
- Set a navigation timeout of 30 seconds per page.
- Run in headless mode by default (`HIBID_HEADLESS=true`).

### Future Optimization

If HiBid's internal API endpoints are discovered (via network tab inspection),
the scraper could switch to direct HTTP requests for those JSON endpoints,
eliminating the Puppeteer dependency. This would be a non-breaking change
isolated to `src/scraper.ts`.

---

## Deduplication

- Maintain an in-memory `Set<string>` of item IDs that have already triggered
  notifications in the current process lifetime.
- On each cycle, only notify for items not already in the set.
- The set resets when the process restarts (acceptable for a lightweight
  scraper; persistent dedup via SQLite can be added later if needed).

---

## Testing Strategy

Test files live in `/test` using `bun:test`.

| Module | Test Focus |
| --- | --- |
| `config.test.ts` | Validates defaults, required var enforcement, type coercion |
| `filter.test.ts` | Keyword matching (case, partial), bid threshold, edge cases |
| `notify.test.ts` | Correct HTTP request formation, auth header, priority logic |
| `scraper.test.ts` | DOM parsing logic (mock HTML fixtures), error handling |
| `scheduler.test.ts` | Dedup set behavior, run-once mode, interval timing |

Filter and config modules are pure logic and straightforward to unit test.
Scraper tests should use static HTML fixtures rather than hitting the live site.
Notify tests should assert on the `fetch` call arguments (mock `fetch`).

---

## HTML Selectors

The following CSS selectors were identified by inspecting the rendered DOM of `https://www.hibid.com/lots?search=air%20fryer`:

### Lot Card Container

| Element | Selector | Notes |
| --- | --- | --- |
| Lot tile wrapper | `app-lot-tile` | Angular component |
| Lot tile class | `.lot-tile` | Grid item container |
| Lot view wrapper | `.lot-view` | Inner container with all lot details |
| Container ID | `#lot-{LOT_ID}` | Unique ID format: `lot-285623151` |

### Lot ID

| Element | Selector | Notes |
| --- | --- | --- |
| ID attribute | `#lot-{LOT_ID}` | Format: `lot-285623151` |
| Link href | `.lot-link` then extract from `href` | URL pattern: `/lot/285623151/...` |

### Title

| Element | Selector | Notes |
| --- | --- | --- |
| Title heading | `.lot-title` | `<h2 class="lot-title">...</h2>` |
| Title link | `.lot-number-lead.lot-link` | Contains href and aria-label |

### Current Bid / Price

| Element | Selector | Notes |
| --- | --- | --- |
| Price realized | `.lot-price-realized` | Shows final price (e.g., `$7.75 USD`) |
| Price title | `.lot-price-realized-title` | Label "Price Realized:" |
| Bid count | `.lot-bid-history` | Shows number of bids in aria-label (e.g., `8 Bids`) |
| Bid history container | `.lot-bid-history-container` | Wraps bid count link |
| Estimate | `.lot-estimate` | Shows price estimate range |
| Reserve indicator | `.lot-reserve-container` | Contains reserve met/not met |

### Other Notable Elements

| Element | Selector | Notes |
| --- | --- | --- |
| Thumbnail image | `.lot-thumbnail` | `<img class="lot-thumbnail">` with `src` attribute |
| Time left | `.lot-time-label` | Shows time remaining |
| Auction status | `.lot-tile-bid-status` | Status indicator |
| Lot buttons | `.lot-buttons` | Bid/Buy buttons container |
| Lot tiles container | `#lot-tiles-1` | Main container for all lot tiles |
| List header | `.lot-list-header` | Header with sort/filter controls |

### Example HTML Structure

```html
<app-lot-tile id="lot-285623151" class="lot-tile ...">
  <div class="lot-view">
    <!-- Title -->
    <div class="lot-lead-heading">
      <a class="lot-number-lead lot-link lot-preview-link" href="/lot/285623151/artscape-sunset...">
        <h2 class="lot-title">Artscape Sunset Window Film 24x36 3 pack</h2>
      </a>
    </div>
    
    <!-- Image -->
    <div class="lot-thumbnail-live-catalog">
      <a href="/lot/285623151/...">
        <img class="lot-thumbnail" src="..." alt="...">
      </a>
    </div>
    
    <!-- Bid Info -->
    <div class="lot-bid-details">
      <div class="lot-bid-history-container">
        <a class="lot-bid-history" aria-label="8 Bids">8 Bids</a>
      </div>
      <div class="lot-price-realized-container">
        <strong class="lot-price-realized-title">Price Realized:</strong>
        <strong class="lot-price-realized">7.75 USD</strong>
      </div>
    </div>
  </div>
</app-lot-tile>
```
