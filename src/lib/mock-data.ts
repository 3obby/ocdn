export type EphemeralPost = {
  nostrEventId: string;
  nostrPubkey: string;
  content: string;
  topic: string | null;
  topicHash: string | null;
  parentContentHash: string | null;
  parentNostrId: string | null;
  powDifficulty: number;
  upvoteWeight: number;
  expiresAt: string;
  promotedToHash: string | null;
  createdAt: string;
};

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
  viewCount: number;
  timestamp: number;
  blockHeight: number;
  confirmations: number;
  ephemeral?: boolean;
  ephemeralStatus?: "cached" | "paying" | "upgraded";
  expiresAt?: string;
  ephemeralCount?: number;
  _section?: "untagged" | "ew";
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

export type FeedFilter =
  | { type: "all" }
  | { type: "topic"; hash: string; name: string | null }
  | { type: "topicless" }
  | { type: "protocol"; protocol: string; label: string };

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

export function shortNostrPubkey(pubkey: string): string {
  return "nostr:" + pubkey.slice(0, 4) + "…" + pubkey.slice(-4);
}

export function formatEphemeralExpiry(expiresAt: string): { label: string; urgent: boolean } {
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return { label: "expired", urgent: true };
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  if (hours >= 24) return { label: `${Math.floor(hours / 24)}d`, urgent: false };
  if (hours >= 2) return { label: `${hours}h`, urgent: false };
  if (hours >= 1) return { label: `${hours}h ${mins}m`, urgent: true };
  return { label: `${mins}m`, urgent: true };
}

export function formatPoWWeight(upvoteWeight: number): string {
  if (upvoteWeight === 0) return "";
  const bits = Math.floor(Math.log2(upvoteWeight));
  return `2^${bits}`;
}
