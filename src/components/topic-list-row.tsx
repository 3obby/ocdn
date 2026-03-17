"use client";

import { Plus, Minus, Eye, MessageCircle, Zap, MoreHorizontal } from "lucide-react";
import { BoostButton } from "./boost-button";

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
  viewCount,
  upvoteCount,
  hasUpvoted,
  onExpand,
  onReply,
  onUpvote,
  onMoreActions,
  onBoosted,
  onOptimisticUpvote,
  isExpanded,
  boostTarget,
  onViewTopic,
}: {
  label: string;
  isListOfTopics?: boolean;
  isBitcoinInscribed: boolean;
  viewCount?: number;
  upvoteCount?: number;
  hasUpvoted?: boolean;
  onExpand: () => void;
  onReply?: () => void;
  onUpvote?: () => void;
  onMoreActions?: () => void;
  onBoosted?: () => void;
  onOptimisticUpvote?: () => void;
  onViewTopic?: () => void;
  isExpanded?: boolean;
  boostTarget?: { nostrEventId: string } | null;
}) {
  const accentClass = isBitcoinInscribed ? "text-yellow-400" : "text-white";
  const mutedClass = "text-white/60";
  const zapClass = hasUpvoted ? accentClass : mutedClass;

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
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); onViewTopic?.(); }}
          className={`flex h-8 min-w-8 items-center justify-center gap-0.5 ${accentClass} transition-colors active:scale-95`}
          aria-label="View topic"
        >
          <Eye size={14} strokeWidth={2} />
          {typeof viewCount === "number" && viewCount > 0 && (
            <span className="text-[10px]">{viewCount > 999 ? `${(viewCount / 1000).toFixed(1)}K` : viewCount}</span>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onReply?.(); }}
          className={`flex h-8 w-8 items-center justify-center ${mutedClass} hover:text-white/80 transition-colors active:scale-95`}
          aria-label="Reply"
        >
          <MessageCircle size={14} strokeWidth={2} />
        </button>
        {boostTarget?.nostrEventId ? (
          <span
            onClick={(e) => e.stopPropagation()}
            className={`flex h-8 min-w-8 items-center justify-center gap-0.5 ${zapClass}`}
            aria-label="Upvote"
          >
            <BoostButton
              target={{ nostrEventId: boostTarget.nostrEventId }}
              size={14}
              onClick={() => onOptimisticUpvote?.()}
              onBoosted={() => onBoosted?.()}
            />
            {typeof upvoteCount === "number" && upvoteCount > 0 && (
              <span className="text-[10px]">{upvoteCount > 999 ? `${(upvoteCount / 1000).toFixed(1)}K` : upvoteCount}</span>
            )}
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onUpvote?.(); }}
            className={`flex h-8 min-w-8 items-center justify-center gap-0.5 ${zapClass} hover:text-yellow-400 transition-colors active:scale-95`}
            aria-label="Upvote"
          >
            <Zap size={14} strokeWidth={2} />
            {typeof upvoteCount === "number" && upvoteCount > 0 && (
              <span className="text-[10px]">{upvoteCount > 999 ? `${(upvoteCount / 1000).toFixed(1)}K` : upvoteCount}</span>
            )}
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onMoreActions?.(); }}
          className={`flex h-8 w-8 items-center justify-center ${mutedClass} hover:text-white/80 transition-colors active:scale-95`}
          aria-label="More actions"
        >
          <MoreHorizontal size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
