export interface AuctionItem {
  id: string;
  title: string;
  currentBid: number;
  url: string;
  category: string;
  endsAt?: Date;
}

export interface FilterResult {
  matched: boolean;
  reason?: string;
}
