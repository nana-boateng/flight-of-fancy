import { config } from "./config";
import type { AuctionItem } from "./types";

export async function sendNotification(items: AuctionItem[]): Promise<void> {
  if (items.length === 0) {
    console.log("No items to notify");
    return;
  }

  const server = config.ntfy.server ?? "https://ntfy.sh";
  const url = `${server}/${config.ntfy.topic}`;

  const count = items.length;
  const title = count === 1 ? "1 Deal Found!" : `${count} Deals Found!`;

  const body = items
    .map((item) => `• ${item.title} - $${item.currentBid}`)
    .join("\n");

  const headers: Record<string, string> = {
    Title: title,
    Tags: "shopping,bargain",
    Priority: "high",
  };

  if (config.ntfy.token) {
    headers.Authorization = config.ntfy.token;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    throw new Error(`Notification failed with status ${response.status}`);
  }

  console.log(`Notification sent: ${title}`);
}
