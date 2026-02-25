export type Post = {
  id: string;
  contentHash: string;
  protocol: string;
  authorPubkey: string;
  text: string;
  topicHash: string | null;
  topicName: string | null;
  parentId: string | null;
  burnTotal: number;
  timestamp: number;
  blockHeight: number;
  confirmations: number;
};

export type Topic = {
  hash: string;
  name: string | null;
  totalBurned: number;
};

export function topicLabel(t: Topic): string {
  return t.name ?? t.hash.slice(0, 8);
}

export type ThreadItem = Post & { depth: number };

export type TopicGroup = {
  topic: Topic | null;
  posts: Post[];
};

export type SortMode = "topics" | "new" | "top";

export function formatSats(sats: number): string {
  if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(1)}M`;
  if (sats >= 10_000) return `${Math.round(sats / 1_000)}K`;
  if (sats >= 1_000) return `${(sats / 1_000).toFixed(1)}K`;
  return String(sats);
}

export function formatTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function shortPubkey(pubkey: string): string {
  return pubkey.slice(-7);
}
