"use client";

import { useState } from "react";
import { MessageCircle, Zap, MoreHorizontal, Plus, ChevronDown, Eye } from "lucide-react";
import { useTextSize, ts } from "@/lib/text-size";
import { PostContent } from "@/components/post-content";

const PREVIEW_LINES = 4;

export function ExpandableContentBlock({
  content,
  level,
  isBitcoinInscribed,
  onReply,
  onUpvote,
  onMoreActions,
  onClick,
  hasChildren = false,
  isChildrenExpanded = false,
  onToggleChildren,
  childrenSlot,
  author,
  datePosted,
  viewCount,
  contentHash,
  onViewInscription,
}: {
  content: string;
  level: number;
  isBitcoinInscribed: boolean;
  onReply?: () => void;
  onUpvote?: () => void;
  onMoreActions?: () => void;
  onClick?: () => void;
  hasChildren?: boolean;
  isChildrenExpanded?: boolean;
  onToggleChildren?: () => void;
  childrenSlot?: React.ReactNode;
  author?: string;
  datePosted?: string;
  viewCount?: number;
  contentHash?: string;
  onViewInscription?: (contentHash: string) => void;
}) {
  const sz = useTextSize();
  const [expanded, setExpanded] = useState(false);
  const lines = content.split(/\r?\n/);
  const hasManyLines = lines.length > PREVIEW_LINES;
  const showExpand = !expanded && hasManyLines;
  const displayContent = expanded || !hasManyLines ? content : lines.slice(0, PREVIEW_LINES).join("\n");

  // Dark-theme gradient: zinc scale for cohesion, subtle steps so L-shape stays clear
  const levelColors = [
    "bg-zinc-900/95",   // 0: darkest (top level), slightly above page bg
    "bg-zinc-800/90",   // 1: one step lighter
    "bg-zinc-700/85",   // 2
    "bg-zinc-600/80",   // 3
    "bg-zinc-500/75",   // 4: lightest
  ];
  const bgClass = levelColors[Math.min(level, levelColors.length - 1)] ?? levelColors[levelColors.length - 1];

  // Narrow left strip in parent color for children grouping (preserves L-shape)
  const levelAccentColors = [
    "rgb(24 24 27)",   // zinc-900 (matches level 0 card)
    "rgb(39 39 42)",   // zinc-800
    "rgb(63 63 70)",   // zinc-700
    "rgb(82 82 91)",   // zinc-600
    "rgb(113 113 122)", // zinc-500
  ];
  const stripColor = levelAccentColors[Math.min(level, levelAccentColors.length - 1)] ?? levelAccentColors[levelAccentColors.length - 1];

  // Card click: expand/collapse children (when has children) or onClick (when no children).
  // Text expand/collapse is only via the "expand"/"collapse" text buttons.
  const cardClickHandler = hasChildren ? onToggleChildren : onClick;

  const showMeta = author != null || datePosted != null || (viewCount != null && viewCount > 0);

  // Non-rectangular shape: bottom only spans the icon width (not full width). L-shaped cutout bottom-left.
  const notchW = 16; // indent for vertical dotted line alignment
  const notchH = 48;
  const lineExtensionUp = notchH + 8; // extend line to meet parent L-corner (buffer for clean connection)
  const iconBarWidth = 140; // bottom edge only extends this far from the right (icons + padding)
  const clipPath = `polygon(0 0, 100% 0, 100% 100%, calc(100% - ${iconBarWidth}px) 100%, calc(100% - ${iconBarWidth}px) calc(100% - ${notchH}px), 0 calc(100% - ${notchH}px))`;

  const cardBody = (
    <div
      className={`relative overflow-hidden border border-white/[0.08] transition-shadow min-w-0 ${
        cardClickHandler ? "cursor-pointer" : ""
      } ${bgClass}`}
      style={{
        boxShadow: "0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -1px 0 rgba(0,0,0,0.05)",
        clipPath,
        WebkitClipPath: clipPath,
      }}
      onClick={cardClickHandler}
    >
      {hasChildren && (
        <span
          className="pointer-events-none absolute right-4 top-3 flex h-6 w-6 items-center justify-center text-white/50"
          aria-hidden
        >
          {isChildrenExpanded ? <ChevronDown size={14} strokeWidth={2.5} /> : <Plus size={14} strokeWidth={2.5} />}
        </span>
      )}
      {showMeta && (
        <div className="flex items-center gap-2 px-4 py-2 text-white/40 border-b border-white/[0.06]" style={{ fontSize: "11px" }}>
          {viewCount != null && viewCount > 0 && (
            isBitcoinInscribed && contentHash && onViewInscription ? (
              <button
                onClick={(e) => { e.stopPropagation(); onViewInscription(contentHash); }}
                className="flex items-center gap-0.5 tabular-nums hover:text-white/60 transition-colors"
                aria-label="View inscription"
              >
                <Eye size={10} strokeWidth={1.5} />
                {viewCount}
              </button>
            ) : (
              <span className="flex items-center gap-0.5 tabular-nums">
                <Eye size={10} strokeWidth={1.5} />
                {viewCount}
              </span>
            )
          )}
          {author && (
            <>
              {(viewCount != null && viewCount > 0) && <span className="text-white/15">&middot;</span>}
              <span>{author}</span>
            </>
          )}
          {datePosted && (
            <>
              {(author || (viewCount != null && viewCount > 0)) && <span className="text-white/15">&middot;</span>}
              <span>{datePosted}</span>
            </>
          )}
        </div>
      )}
      <div
        className={`min-w-0 px-4 py-3 ${ts(sz)} leading-relaxed text-white/90 break-words whitespace-pre-wrap text-left overflow-wrap-anywhere`}
      >
        <PostContent content={displayContent} />
      </div>
      {showExpand && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          className="w-full px-4 py-2 text-left text-[12px] text-[#FF6800] hover:bg-white/[0.02] transition-colors"
        >
          expand
        </button>
      )}
      {expanded && hasManyLines && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
          className="w-full px-4 py-2 text-left text-[12px] text-[#FF6800] hover:bg-white/[0.02] transition-colors"
        >
          collapse
        </button>
      )}
      <div className="flex items-center justify-end gap-1 border-t border-white/[0.06] pl-0.5 pr-0.5 pb-2.5 pt-2 mt-1">
        {onUpvote && (
          <button
            onClick={(e) => { e.stopPropagation(); onUpvote(); }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-white/50 hover:text-[#FF6800] transition-colors active:scale-95"
            aria-label="Upvote"
          >
            <Zap size={14} strokeWidth={2} />
          </button>
        )}
        {onReply && (
          <button
            onClick={(e) => { e.stopPropagation(); onReply(); }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-white/50 hover:text-[#FF6800] transition-colors active:scale-95"
            aria-label="Reply"
          >
            <MessageCircle size={14} strokeWidth={2} />
          </button>
        )}
        {onMoreActions && (
          <button
            onClick={(e) => { e.stopPropagation(); onMoreActions(); }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-white/50 hover:text-white/80 transition-colors active:scale-95"
            aria-label="More actions"
          >
            <MoreHorizontal size={16} strokeWidth={2} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-2 mb-2 min-w-0">
      {cardBody}
      {isChildrenExpanded && hasChildren && childrenSlot && (
        <div
          className="relative pl-4 pt-2 pb-1 min-w-0"
          style={{
            marginLeft: notchW,
            paddingLeft: 12,
          }}
        >
          <div
            className="absolute left-0 w-0 border-l-2 border-dotted border-white/[0.12] pointer-events-none"
            style={{ top: -lineExtensionUp, height: `calc(100% + ${lineExtensionUp}px)` }}
            aria-hidden
          />
          <div
            className="absolute left-0 w-[3px] -ml-px pointer-events-none"
            style={{ top: -lineExtensionUp, height: `calc(100% + ${lineExtensionUp}px)`, backgroundColor: stripColor }}
            aria-hidden
          />
          {childrenSlot}
        </div>
      )}
    </div>
  );
}
