import { formatSats } from "./mock-data";

const AVATAR_BG = "bg-gradient-to-br from-[#f4b63f]/35 to-[#e93223]/25";

export function topicAvatarProps(name: string | null, hash: string): { bg: string; initials: string } {
  const initials = name
    ? name.slice(0, 2).toUpperCase()
    : hash.slice(0, 2).toUpperCase();
  return { bg: AVATAR_BG, initials };
}

export function formatTopicStats(postCount: number, totalBurned: number): string {
  const parts: string[] = [];
  if (postCount > 0) parts.push(`${postCount.toLocaleString()} posts`);
  if (totalBurned > 0) parts.push(`${formatSats(totalBurned)} sats`);
  return parts.length > 0 ? parts.join(" · ") : "—";
}
