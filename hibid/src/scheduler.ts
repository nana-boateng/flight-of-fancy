import { config } from "./config";
import { scrapeAll, closeBrowser } from "./scraper";
import { filterItems, filterByExpiringSoon } from "./filter";
import { sendNotification } from "./notify";

async function runOnce(): Promise<void> {
  try {
    console.log("Running scrape...");
    const items = await scrapeAll();
    console.log(`Scraped ${items.length} items`);

    if (items.length > 0) {
      console.log("Sample items:", JSON.stringify(items.slice(0, 3).map(i => ({ title: i.title?.slice(0, 30), bid: i.currentBid, endsAt: i.endsAt }))));
    }

    const filtered = filterItems(items);
    console.log(`Filtered to ${filtered.length} matching items`);

    const expiringSoon = filterByExpiringSoon(filtered, 30);
    console.log(`Expiring soon: ${expiringSoon.length} items`);

    if (expiringSoon.length > 0) {
      await sendNotification(expiringSoon);
      console.log(`Sent notification for ${expiringSoon.length} items`);
    }

    console.log("Run complete");
  } finally {
    await closeBrowser();
  }
}

function startScheduler(): void {
  const intervalMs = config.scraper.checkIntervalMinutes * 60 * 1000;
  console.log(
    `Scheduler started, checking every ${config.scraper.checkIntervalMinutes} minutes`,
  );

  runOnce().catch(err => console.error("Initial scrape failed:", err));

  setInterval(() => {
    runOnce().catch(err => console.error("Scheduled scrape failed:", err));
  }, intervalMs);
}

export { runOnce, startScheduler };
