"use client";

import { type Topic, topicLabel } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";

export function TopicStrip({
  topics,
  active,
  onSelect,
}: {
  topics: Topic[];
  active: string | null;
  onSelect: (hash: string | null) => void;
}) {
  const sz = useTextSize();

  return (
    <div className="flex items-center gap-3 overflow-x-auto px-4 py-2 border-b border-border scrollbar-none">
      {topics.map((t) => (
        <button
          key={t.hash}
          onClick={() => onSelect(active === t.hash ? null : t.hash)}
          className={`shrink-0 px-3 py-1 ${ts(sz)} leading-tight tracking-wide transition-colors ${
            active === t.hash
              ? "text-white bg-white/10"
              : t.name
                ? "text-white/30 hover:text-white/60"
                : "text-white/15 hover:text-white/40 font-mono"
          }`}
        >
          {topicLabel(t)}
        </button>
      ))}
    </div>
  );
}
