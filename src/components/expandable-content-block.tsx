"use client";

import { useState, useCallback } from "react";
import { MessageCircle, Zap, MoreHorizontal, Eye, Link2, Copy } from "lucide-react";
import { useTextSize, ts } from "@/lib/text-size";
import { PostContent } from "@/components/post-content";
import { BoostButton } from "@/components/boost-button";
import { txExplorerHref } from "@/lib/explorer-url";

const PREVIEW_LINES = 4;

export function ExpandableContentBlock({
  content,
  level,
  isBitcoinInscribed,
  onReply,
  onClick,
  hasChildren = false,
  isChildrenExpanded = false,
  onToggleChildren,
  childrenSlot,
  author,
  datePosted,
  viewCount,
  txid,
  nostrEventId,
  childCount = 0,
  onExpandAllChildren,
}: {
  content: string;
  level: number;
  isBitcoinInscribed: boolean;
  onReply?: () => void;
  onClick?: () => void;
  hasChildren?: boolean;
  isChildrenExpanded?: boolean;
  onToggleChildren?: () => void;
  childrenSlot?: React.ReactNode;
  author?: string;
  datePosted?: string;
  viewCount?: number;
  txid?: string | null;
  nostrEventId?: string | null;
  childCount?: number;
  onExpandAllChildren?: () => void;
}) {
  const sz = useTextSize();
  const [expanded, setExpanded] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [copiedFeedback, setCopiedFeedback] = useState<string | null>(null);
  const lines = content.split(/\r?\n/);
  const hasManyLines = lines.length > PREVIEW_LINES;
  const showExpand = !expanded && hasManyLines;
  const displayContent = expanded || !hasManyLines ? content : lines.slice(0, PREVIEW_LINES).join("\n");

  const levelColors = [
    "bg-zinc-900/95",
    "bg-zinc-800/90",
    "bg-zinc-700/85",
    "bg-zinc-600/80",
    "bg-zinc-500/75",
  ];
  const bgClass = levelColors[Math.min(level, levelColors.length - 1)] ?? levelColors[levelColors.length - 1];

  const levelAccentColors = [
    "rgb(24 24 27)",
    "rgb(39 39 42)",
    "rgb(63 63 70)",
    "rgb(82 82 91)",
    "rgb(113 113 122)",
  ];
  const stripColor = levelAccentColors[Math.min(level, levelAccentColors.length - 1)] ?? levelAccentColors[levelAccentColors.length - 1];

  const cardClickHandler = hasChildren ? onToggleChildren : onClick;

  const hasViewCount = viewCount != null && viewCount > 0;
  const hasExplorer = Boolean(isBitcoinInscribed && txid);
  const showViewAffordance = hasViewCount || hasExplorer;
  const showMeta = author != null || datePosted != null || showViewAffordance;

  const viewEyeClass = isBitcoinInscribed
    ? "text-yellow-400 hover:text-yellow-300"
    : "text-white/40 hover:text-white/55";

  const notchW = 16;
  const notchH = 48;
  const lineExtensionUp = notchH + 8;
  const iconBarWidth = 164;
  const metaH = 32;

  const clipPath = showMeta
    ? `polygon(0 0, 65% 0, 65% ${metaH}px, 100% ${metaH}px, 100% 100%, calc(100% - ${iconBarWidth}px) 100%, calc(100% - ${iconBarWidth}px) calc(100% - ${notchH}px), 0 calc(100% - ${notchH}px))`
    : `polygon(0 0, 100% 0, 100% 100%, calc(100% - ${iconBarWidth}px) 100%, calc(100% - ${iconBarWidth}px) calc(100% - ${notchH}px), 0 calc(100% - ${notchH}px))`;

  const showCopied = useCallback((label: string) => {
    setCopiedFeedback(label);
    setTimeout(() => setCopiedFeedback(null), 1500);
  }, []);

  const handleCopyContent = useCallback(() => {
    navigator.clipboard?.writeText(content);
    showCopied("copied");
    setMoreMenuOpen(false);
  }, [content, showCopied]);

  const handleCopyLink = useCallback(() => {
    const id = nostrEventId ?? txid;
    if (id) {
      const url = `${window.location.origin}/${encodeURIComponent(id)}`;
      navigator.clipboard?.writeText(url);
      showCopied("link copied");
    } else {
      navigator.clipboard?.writeText(content);
      showCopied("copied");
    }
    setMoreMenuOpen(false);
  }, [nostrEventId, txid, content, showCopied]);

  const cardBody = (
    <div
      className={`relative overflow-hidden border border-white/[0.08] transition-shadow min-w-0 ${
        cardClickHandler ? "cursor-pointer" : ""
      } ${bgClass}`}
      style={{
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.35))",
        clipPath,
        WebkitClipPath: clipPath,
      }}
      onClick={cardClickHandler}
    >
      {/* ++N / --N button is rendered outside clip-path, in the outer wrapper */}
      {showMeta && (
        <div className="flex items-center gap-2 px-4 text-white/40 border-b border-white/[0.06]" style={{ fontSize: "11px", height: metaH }}>
          {showViewAffordance && (
            hasExplorer ? (
              <a
                href={txExplorerHref(txid!)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className={`flex items-center gap-0.5 tabular-nums transition-colors underline-offset-2 hover:underline ${viewEyeClass}`}
                aria-label="View inscription transaction on block explorer"
              >
                <Eye size={10} strokeWidth={1.5} className="shrink-0" />
                {hasViewCount ? viewCount : null}
              </a>
            ) : (
              <span className={`flex items-center gap-0.5 tabular-nums transition-colors ${viewEyeClass}`}>
                <Eye size={10} strokeWidth={1.5} className="shrink-0" />
                {hasViewCount ? viewCount : null}
              </span>
            )
          )}
          {author && (
            <>
              {showViewAffordance && <span className="text-white/15">&middot;</span>}
              <span>{author}</span>
            </>
          )}
          {datePosted && (
            <>
              {(author || showViewAffordance) && <span className="text-white/15">&middot;</span>}
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
      <div className="relative flex items-center justify-end gap-1.5 border-t border-white/[0.06] pl-2 pr-2 pb-2.5 pt-2 mt-1">
        {nostrEventId ? (
          <span
            onClick={(e) => e.stopPropagation()}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center"
          >
            <BoostButton
              target={{ nostrEventId }}
              size={14}
            />
          </span>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onReply?.(); }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-white/50 hover:text-yellow-400 transition-colors active:scale-95"
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
        <div className="relative">
          <button
            onClick={(e) => { e.stopPropagation(); setMoreMenuOpen((v) => !v); }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-white/50 hover:text-white/80 transition-colors active:scale-95"
            aria-label="More actions"
          >
            {copiedFeedback ? (
              <span className="text-[10px] text-green-400/80">{copiedFeedback}</span>
            ) : (
              <MoreHorizontal size={16} strokeWidth={2} />
            )}
          </button>
          {moreMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setMoreMenuOpen(false); }} />
              <div
                className="absolute right-0 bottom-full mb-1 z-50 min-w-[140px] rounded border border-white/10 bg-zinc-900 shadow-xl shadow-black/50"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={handleCopyContent}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-[12px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
                >
                  <Copy size={12} strokeWidth={2} />
                  Copy text
                </button>
                {(nostrEventId || txid) && (
                  <button
                    onClick={handleCopyLink}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-[12px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors"
                  >
                    <Link2 size={12} strokeWidth={2} />
                    Copy link
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div className="relative mx-2 mb-2 min-w-0" data-nostr-id={nostrEventId ?? undefined}>
      {hasChildren && childCount > 0 && (
        <button
          onClick={onExpandAllChildren}
          className="absolute right-3 z-20 font-mono text-[11px] tabular-nums text-[#FF6800] hover:text-[#ff8533] transition-colors active:scale-95"
          style={{ top: showMeta ? 6 : 8 }}
          aria-label={isChildrenExpanded ? "Collapse all children" : "Expand all children"}
        >
          {isChildrenExpanded ? `\u2212\u2212${childCount}` : `++${childCount}`}
        </button>
      )}
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
