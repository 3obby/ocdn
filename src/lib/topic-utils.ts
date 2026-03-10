import { formatSats } from "./mock-data";

const AVATAR_BGS = [
  "bg-burn/30",
  "bg-amber-500/30",
  "bg-orange-500/30",
  "bg-yellow-600/30",
  "bg-rose-500/25",
] as const;

export function topicAvatarProps(name: string | null, hash: string): { bg: string; initials: string } {
  const str = (name ?? hash).slice(0, 8);
  const idx = str.split("").reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0) % AVATAR_BGS.length;
  const initials = name
    ? name.slice(0, 2).toUpperCase()
    : hash.slice(0, 2).toUpperCase();
  return { bg: AVATAR_BGS[Math.abs(idx)], initials };
}

export function formatTopicStats(postCount: number, totalBurned: number): string {
  const parts: string[] = [];
  if (postCount > 0) parts.push(`${postCount.toLocaleString()} posts`);
  if (totalBurned > 0) parts.push(`${formatSats(totalBurned)} sats`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
