"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatSats } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";

export function ComposeSheet({
  replyToId,
  topicName,
  onClose,
  onSubmitted,
}: {
  replyToId: string | null;
  topicName: string | null;
  onClose: () => void;
  onSubmitted?: () => void;
}) {
  const sz = useTextSize();
  const [text, setText] = useState("");
  const [costSats, setCostSats] = useState<number | null>(null);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const label = replyToId
    ? "reply"
    : topicName
      ? `\u2192 ${topicName}`
      : "new post";

  useEffect(() => {
    fetch("/api/costs")
      .then((r) => r.json())
      .then((data) => {
        const cost = replyToId
          ? data.reply?.totalFeeSats
          : data.post?.totalFeeSats;
        setCostSats(cost ?? null);
      })
      .catch(() => {});
  }, [replyToId]);

  const handleSubmit = async () => {
    if (!text.trim() || status === "submitting") return;

    setStatus("submitting");
    setErrorMsg(null);

    try {
      const url = replyToId ? "/api/reply" : "/api/post";
      const body = replyToId
        ? { content: text.trim(), parentHash: replyToId }
        : { content: text.trim(), topic: topicName ?? undefined };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      setStatus("success");
      setTimeout(() => {
        onSubmitted?.();
        onClose();
      }, 800);
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to submit");
    }
  };

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        className="bg-black border-t border-border p-0 rounded-t-xl max-h-[60vh] flex flex-col"
      >
        <SheetHeader className="px-4 pt-3 pb-2 border-b border-border shrink-0">
          <SheetTitle
            className={`${ts(sz)} text-white/40 font-light tracking-wide`}
          >
            {status === "submitting"
              ? "broadcasting\u2026"
              : status === "success"
                ? "sent"
                : label}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="\u2026"
            autoFocus
            disabled={status === "submitting" || status === "success"}
            className={`w-full h-full min-h-[120px] resize-none bg-transparent ${ts(sz)} text-white placeholder:text-white/15 outline-none leading-relaxed disabled:opacity-40`}
          />
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
          <div className="flex flex-col">
            <span className={`${ts(sz)} text-white/20`}>
              {costSats != null ? `~${formatSats(costSats)} sats` : "\u2014"}
            </span>
            {status === "error" && errorMsg && (
              <span className="text-[11px] text-red-400/60 mt-0.5">
                {errorMsg}
              </span>
            )}
          </div>
          <button
            className={`px-5 py-2 ${ts(sz)} tracking-wide transition-colors ${
              status === "submitting" || status === "success"
                ? "text-black/40 bg-white/60"
                : "text-black bg-white hover:bg-white/90"
            }`}
            onClick={handleSubmit}
            disabled={
              status === "submitting" ||
              status === "success" ||
              !text.trim()
            }
          >
            {status === "submitting"
              ? "\u2026"
              : status === "success"
                ? "sent"
                : "post"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
