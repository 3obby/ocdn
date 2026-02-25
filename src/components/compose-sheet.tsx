"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getPostById, shortPubkey } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";

export function ComposeSheet({
  replyToId,
  topicName,
  onClose,
}: {
  replyToId: string | null;
  topicName: string | null;
  onClose: () => void;
}) {
  const sz = useTextSize();
  const [text, setText] = useState("");
  const parent = replyToId ? getPostById(replyToId) : null;

  const label = parent
    ? `→ ${shortPubkey(parent.authorPubkey)}`
    : topicName
      ? `→ ${topicName}`
      : "new post";

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="bg-black border-t border-border p-0 rounded-t-xl max-h-[60vh] flex flex-col"
      >
        <SheetHeader className="px-4 pt-3 pb-2 border-b border-border shrink-0">
          <SheetTitle className={`${ts(sz)} text-white/40 font-light tracking-wide`}>
            {label}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="…"
            autoFocus
            className={`w-full h-full min-h-[120px] resize-none bg-transparent ${ts(sz)} text-white placeholder:text-white/15 outline-none leading-relaxed`}
          />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
          <span className={`${ts(sz)} text-white/20`}>~1,400 sats</span>
          <button
            className={`px-5 py-2 ${ts(sz)} tracking-wide text-black bg-white hover:bg-white/90 transition-colors`}
            onClick={onClose}
          >
            post
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
