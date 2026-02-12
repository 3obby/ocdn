"use client";

import { ContentCard, type ContentCardProps } from "./Card";

interface FeedProps {
  items: ContentCardProps[];
}

export function LeaderboardFeed({ items }: FeedProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-lg text-muted">No content indexed yet.</p>
        <p className="mt-2 text-sm text-muted">
          Be the first to Fortify content and seed the importance index.
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {items.map((item, i) => (
        <ContentCard key={item.hash} {...item} rank={i + 1} />
      ))}
    </div>
  );
}
