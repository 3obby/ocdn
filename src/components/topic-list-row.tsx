"use client";

import { Plus, Minus } from "lucide-react";

function TopicsListIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={`font-mono font-semibold leading-none ${className}`}
      style={{ fontSize: size * 0.85 }}
      aria-hidden
    >
      {"/\u002A"}
    </span>
  );
}

export function TopicListRow({
  label,
  isListOfTopics,
  isBitcoinInscribed,
  onExpand,
  isExpanded,
}: {
  label: string;
  isListOfTopics?: boolean;
  isBitcoinInscribed: boolean;
  onExpand: () => void;
  isExpanded?: boolean;
}) {
  const accentClass = isBitcoinInscribed ? "text-yellow-400" : "text-white";

  return (
    <div
      onClick={onExpand}
      className={`flex min-h-[44px] cursor-pointer items-center gap-2 border-b border-white/[0.06] px-4 py-2.5 transition-colors active:bg-white/[0.02]`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onExpand(); } }}
      aria-label={isExpanded ? "Collapse" : "Expand"}
      aria-expanded={isExpanded}
    >
      <span
        className={`pointer-events-none flex h-6 w-6 shrink-0 items-center justify-center ${accentClass} opacity-70`}
        aria-hidden
      >
        {isExpanded ? <Minus size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
      </span>
      <span className={`min-w-0 flex-1 truncate text-sm ${isListOfTopics ? "font-mono" : ""}`}>
        {isListOfTopics ? <TopicsListIcon size={14} className="inline align-middle" /> : label}
      </span>
    </div>
  );
}
