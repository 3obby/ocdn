"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { formatSats, type EphemeralPost } from "@/lib/mock-data";
import { useTextSize, ts } from "@/lib/text-size";
import {
  getOrCreateSessionKeypair,
  buildPostEvent,
  broadcastToRelays,
  getSessionPubkey,
  signEvent,
} from "@/lib/nostr/client";
import { startMining, mineAndSign } from "@/lib/nostr/pow";
import type { MiningHandle } from "@/lib/nostr/pow";
import { topicHash as computeTopicHash } from "@/lib/protocol/crypto";
import { POW, powWeight as computePowWeight } from "@/lib/pow-config";

type Step = "compose" | "preview" | "pay" | "status";
type PaymentStatus =
  | "creating"
  | "waiting"
  | "detected"
  | "broadcasting"
  | "confirmed"
  | "expired"
  | "failed"
  | "error";

interface CostEstimate {
  minerFee: number;
  rake: number;
  totalSats: number;
}

interface PaymentData {
  id: string;
  address: string;
  amountSats: number;
  bitcoinUri: string;
  expiresAt: string;
}

export function ComposeSheet({
  replyToId,
  replyToNostrId,
  topicName,
  initialText,
  onClose,
  onSubmitted,
}: {
  replyToId: string | null;
  replyToNostrId?: string | null;
  topicName: string | null;
  initialText?: string | null;
  onClose: () => void;
  onSubmitted?: (ephPost?: EphemeralPost) => void;
}) {
  const sz = useTextSize();
  const [step, setStep] = useState<Step>(initialText ? "preview" : "compose");
  const [text, setText] = useState(initialText ?? "");
  const [cost, setCost] = useState<CostEstimate | null>(null);
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [payStatus, setPayStatus] = useState<PaymentStatus>("creating");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState<"address" | "amount" | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [minedDifficulty, setMinedDifficulty] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const ephCreatedRef = useRef(false);
  const miningHandleRef = useRef<MiningHandle | null>(null);
  const miningDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReply = replyToId !== null || replyToNostrId != null;
  const isBtcReply = replyToId !== null;
  const isNostrReply = replyToNostrId != null && !isBtcReply;
  const label = isReply
    ? "reply"
    : topicName
      ? `\u2192 ${topicName}`
      : "new post";

  // Background PoW mining: restart (debounced) when content changes
  useEffect(() => {
    if (step !== "compose" || !text.trim()) {
      miningHandleRef.current?.stop();
      miningHandleRef.current = null;
      setMinedDifficulty(0);
      return;
    }

    if (miningDebounceRef.current) clearTimeout(miningDebounceRef.current);

    miningDebounceRef.current = setTimeout(() => {
      miningHandleRef.current?.stop();
      miningHandleRef.current = null;

      try {
        const { privkey, pubkey } = getOrCreateSessionKeypair();
        const template = buildPostEvent({
          content: text.trim(),
          pubkey,
          topic: topicName ?? undefined,
          parentContentHash: isBtcReply ? replyToId : undefined,
          parentNostrId: isNostrReply ? replyToNostrId : undefined,
        });

        const { handle } = startMining(
          template,
          Number.MAX_SAFE_INTEGER,
          privkey,
          (p) => setMinedDifficulty(p.currentDifficulty),
        );
        miningHandleRef.current = handle;
      } catch {}
    }, 500);

    return () => {
      if (miningDebounceRef.current) clearTimeout(miningDebounceRef.current);
    };
  }, [text, step, topicName, replyToId, replyToNostrId, isBtcReply, isNostrReply]);

  // Cleanup mining on unmount
  useEffect(() => {
    return () => {
      miningHandleRef.current?.stop();
      if (miningDebounceRef.current) clearTimeout(miningDebounceRef.current);
    };
  }, []);

  useEffect(() => {
    fetch("/api/costs")
      .then((r) => r.json())
      .then((data) => {
        const c = isReply ? data.reply : data.post;
        if (c) setCost({ minerFee: c.minerFee, rake: c.rake, totalSats: c.totalSats });
      })
      .catch(() => {});
  }, [isReply]);

  useEffect(() => {
    if (!text.trim()) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ content: text.trim() });
      fetch(`/api/costs?${params}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data) => {
          const c = isReply ? data.reply : data.post;
          if (c) setCost({ minerFee: c.minerFee, rake: c.rake, totalSats: c.totalSats });
        })
        .catch(() => {});
    }, 400);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [text, isReply]);

  useEffect(() => {
    if (!payment?.expiresAt) return;
    const update = () => {
      const left = Math.max(0, Math.floor((new Date(payment.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) setPayStatus("expired");
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [payment?.expiresAt]);

  useEffect(() => {
    if (step !== "pay" || !payment?.id || payStatus !== "waiting") return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/${payment.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "detected" || data.status === "broadcasting") {
          setPayStatus("broadcasting");
          setStep("status");
        } else if (data.status === "confirmed") {
          setPayStatus("confirmed");
          setStep("status");
        } else if (data.status === "expired") {
          setPayStatus("expired");
        } else if (data.status === "failed") {
          setPayStatus("failed");
          setErrorMsg("Transaction failed");
        }
      } catch { /* ignore poll errors */ }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, payment?.id, payStatus]);

  useEffect(() => {
    if (step !== "status" || !payment?.id || payStatus === "confirmed") return;
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/payment/${payment.id}`);
        if (!res.ok) return;
        const data = await res.json();
        if (data.status === "confirmed") {
          setPayStatus("confirmed");
          setTimeout(() => {
            onSubmitted?.();
            onClose();
          }, 1200);
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(iv);
  }, [step, payment?.id, payStatus, onSubmitted, onClose]);

  const sessionPubkey = getSessionPubkey();

  const handlePostFree = useCallback(async () => {
    if (!text.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const { privkey, pubkey } = getOrCreateSessionKeypair();

      // Try to use background-mined result if it meets minimum
      const bestEvent = miningHandleRef.current?.stop() ?? null;
      miningHandleRef.current = null;

      let signed;
      if (bestEvent && minedDifficulty >= POW.MIN_POST) {
        signed = signEvent(bestEvent, privkey);
      } else {
        const template = buildPostEvent({
          content: text.trim(),
          pubkey,
          topic: topicName ?? undefined,
          parentContentHash: isBtcReply ? replyToId : undefined,
          parentNostrId: isNostrReply ? replyToNostrId : undefined,
        });
        const { promise } = mineAndSign(template, privkey, POW.MIN_POST);
        signed = await promise;
      }

      const actualDifficulty = Math.max(minedDifficulty, POW.MIN_POST);

      const res = await fetch("/api/ephemeral/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signedEvent: signed }),
      });
      const data = await res.json();

      broadcastToRelays(signed).catch(() => {});

      let ephTopicHash: string | null = null;
      if (topicName) {
        const normalized = topicName.toLowerCase().trim().normalize("NFC");
        const hashBytes = computeTopicHash(normalized);
        ephTopicHash = Array.from(hashBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
      }

      const ephPost: EphemeralPost = {
        nostrEventId: signed.id,
        nostrPubkey: signed.pubkey,
        content: signed.content,
        topic: topicName ?? null,
        topicHash: ephTopicHash,
        parentContentHash: isBtcReply ? replyToId : null,
        parentNostrId: isNostrReply ? (replyToNostrId ?? null) : null,
        replyDepth: isNostrReply ? 1 : 0,
        anchoredToBtc: isBtcReply,
        powDifficulty: actualDifficulty,
        upvoteWeight: Number(computePowWeight(actualDifficulty)),
        boostCount: 0,
        lastBoostedAt: null,
        expiresAt: data.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        promotedToHash: null,
        createdAt: new Date().toISOString(),
      };

      onSubmitted?.(ephPost);
      onClose();
    } catch (err) {
      setIsSubmitting(false);
      setErrorMsg(err instanceof Error ? err.message : "posting failed");
    }
  }, [text, topicName, isReply, replyToId, minedDifficulty, isSubmitting, onSubmitted, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleNext = useCallback(() => {
    if (!text.trim()) return;
    miningHandleRef.current?.stop();
    miningHandleRef.current = null;
    setStep("preview");
  }, [text]);

  const handlePay = useCallback(async () => {
    setStep("pay");
    setPayStatus("creating");
    setErrorMsg(null);

    try {
      const body: Record<string, unknown> = {
        actionType: isReply ? "reply" : "post",
        content: text.trim(),
      };
      if (isBtcReply) body.parentHash = replyToId;
      else if (topicName) body.topic = topicName;

      if (!ephCreatedRef.current) {
        ephCreatedRef.current = true;
        const ephBody: Record<string, unknown> = {
          content: text.trim(),
          topic: topicName ?? undefined,
        };
        if (isBtcReply) ephBody.parentHash = replyToId;

        fetch("/api/ephemeral", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ephBody),
        }).catch(() => {});
      }

      const res = await fetch("/api/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Error ${res.status}`);
      }

      const data = await res.json();
      setPayment({
        id: data.id,
        address: data.address,
        amountSats: data.amountSats,
        bitcoinUri: data.bitcoinUri,
        expiresAt: data.expiresAt,
      });
      setPayStatus("waiting");
    } catch (e) {
      setPayStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Failed to create payment");
    }
  }, [text, isReply, replyToId, topicName, isBtcReply]);

  const copyToClipboard = useCallback(
    (value: string, type: "address" | "amount") => {
      navigator.clipboard.writeText(value).then(() => {
        setCopied(type);
        setTimeout(() => setCopied(null), 1500);
      });
    },
    [],
  );

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const postLabel = minedDifficulty > 0 ? `post ${minedDifficulty}z` : "post";

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="bg-black border-t border-border p-0 rounded-t-xl max-h-[80vh] flex flex-col"
      >
        <SheetHeader className="px-4 pt-3 pb-2 border-b border-border shrink-0">
          <SheetTitle
            className={`${ts(sz)} text-white/40 font-light tracking-wide`}
          >
            {step === "compose"
              ? label
              : step === "preview"
                ? "preview"
                : step === "pay"
                  ? "pay to post"
                  : payStatus === "confirmed"
                    ? "posted"
                    : "broadcasting\u2026"}
          </SheetTitle>
        </SheetHeader>

        {step === "compose" && (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="\u2026"
                autoFocus
                className={`w-full h-full min-h-[120px] resize-none bg-transparent ${ts(sz)} text-white placeholder:text-white/15 outline-none leading-relaxed`}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3 border-t border-border shrink-0">
              <span className={`text-[10px] text-white/15 font-mono truncate max-w-[120px]`}>
                {sessionPubkey ? sessionPubkey.slice(0, 8) + "\u2026" : ""}
              </span>
              <div className="flex items-center gap-2">
                {cost && (
                  <button
                    className={`px-3 py-2 ${ts(sz)} tracking-wide transition-colors text-white/25 hover:text-white/50 ${
                      !text.trim() ? "opacity-40 cursor-not-allowed" : ""
                    }`}
                    onClick={handleNext}
                    disabled={!text.trim()}
                    title={`${formatSats(cost.totalSats)} sats`}
                  >
                    ₿
                  </button>
                )}
                <button
                  className={`px-5 py-2 ${ts(sz)} tracking-wide transition-colors ${
                    text.trim() && !isSubmitting
                      ? "text-black bg-white hover:bg-white/90"
                      : "text-black/40 bg-white/20 cursor-not-allowed"
                  }`}
                  onClick={handlePostFree}
                  disabled={!text.trim() || isSubmitting}
                >
                  {isSubmitting ? "posting\u2026" : postLabel}
                </button>
              </div>
            </div>
          </>
        )}

        {step === "preview" && (
          <>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="border border-border/50 rounded-lg p-4 mb-4">
                {topicName && !isReply && (
                  <span className={`${ts(sz)} text-burn/60 block mb-1`}>
                    {topicName}
                  </span>
                )}
                <p className={`${ts(sz)} text-white/90 leading-relaxed whitespace-pre-wrap`}>
                  {text}
                </p>
              </div>

              {cost && (
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className={`${ts(sz)} text-white/30`}>miner fee</span>
                    <span className={`${ts(sz)} text-white/50 tabular-nums`}>
                      {formatSats(cost.minerFee)} sats
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className={`${ts(sz)} text-white/30`}>portal fee</span>
                    <span className={`${ts(sz)} text-white/50 tabular-nums`}>
                      {formatSats(cost.rake)} sats
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-border/30 pt-1.5">
                    <span className={`${ts(sz)} text-white/60`}>total</span>
                    <span className={`${ts(sz)} text-white tabular-nums`}>
                      {formatSats(cost.totalSats)} sats
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 px-4 py-3 border-t border-border shrink-0">
              <button
                className={`flex-1 px-4 py-2 ${ts(sz)} tracking-wide text-white/40 hover:text-white/60 transition-colors`}
                onClick={() => setStep("compose")}
              >
                back
              </button>
              <button
                className={`flex-1 px-4 py-2 ${ts(sz)} tracking-wide text-black bg-white hover:bg-white/90 transition-colors`}
                onClick={handlePay}
              >
                pay with bitcoin
              </button>
            </div>
          </>
        )}

        {step === "pay" && (
          <>
            <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
              {payStatus === "creating" && (
                <div className={`${ts(sz)} text-white/20 animate-pulse py-12`}>
                  creating payment\u2026
                </div>
              )}

              {payStatus === "error" && (
                <div className="flex flex-col items-center gap-3 py-8">
                  <span className={`${ts(sz)} text-red-400/60`}>
                    {errorMsg}
                  </span>
                  <button
                    onClick={handlePay}
                    className={`${ts(sz)} text-white/40 hover:text-white/60`}
                  >
                    retry
                  </button>
                </div>
              )}

              {(payStatus === "waiting" || payStatus === "expired") && payment && (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="bg-white p-3 rounded-lg">
                    <QRCodeSVG
                      value={payment.bitcoinUri}
                      size={200}
                      level="M"
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>

                  <button
                    onClick={() => copyToClipboard(String(payment.amountSats), "amount")}
                    className="group flex items-center gap-1.5"
                  >
                    <span className={`${ts(sz)} text-white tabular-nums`}>
                      {formatSats(payment.amountSats)} sats
                    </span>
                    <span className={`text-[10px] text-white/20 group-hover:text-white/40 transition-colors`}>
                      {copied === "amount" ? "copied" : "tap to copy"}
                    </span>
                  </button>

                  <button
                    onClick={() => copyToClipboard(payment.address, "address")}
                    className="group w-full px-3"
                  >
                    <span className="text-[11px] text-white/30 font-mono break-all leading-relaxed group-hover:text-white/50 transition-colors">
                      {payment.address}
                    </span>
                    <span className="block text-[10px] text-white/15 mt-0.5 group-hover:text-white/30 transition-colors">
                      {copied === "address" ? "copied" : "tap to copy address"}
                    </span>
                  </button>

                  <a
                    href={payment.bitcoinUri}
                    className={`w-full text-center px-4 py-2.5 ${ts(sz)} tracking-wide text-white/60 border border-border/50 hover:border-border hover:text-white/80 transition-colors`}
                  >
                    open in wallet
                  </a>

                  <div className="flex items-center gap-2">
                    {payStatus === "waiting" && (
                      <>
                        <span className="h-1.5 w-1.5 rounded-full bg-white/20 animate-pulse" />
                        <span className="text-[11px] text-white/20">
                          waiting for payment
                        </span>
                      </>
                    )}
                    {payStatus === "expired" && (
                      <span className="text-[11px] text-red-400/50">
                        expired
                      </span>
                    )}
                    {secondsLeft !== null && secondsLeft > 0 && (
                      <span className="text-[10px] text-white/15 tabular-nums">
                        {formatCountdown(secondsLeft)}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center px-4 py-3 border-t border-border shrink-0">
              <button
                className={`px-4 py-2 ${ts(sz)} tracking-wide text-white/30 hover:text-white/50 transition-colors`}
                onClick={() => {
                  if (pollRef.current) clearInterval(pollRef.current);
                  setStep("preview");
                }}
              >
                back
              </button>
            </div>
          </>
        )}

        {step === "status" && (
          <div className="flex-1 flex flex-col items-center justify-center p-4 gap-3">
            {payStatus === "broadcasting" && (
              <>
                <span className="h-2 w-2 rounded-full bg-white/30 animate-pulse" />
                <span className={`${ts(sz)} text-white/40`}>
                  payment received — broadcasting\u2026
                </span>
              </>
            )}
            {payStatus === "confirmed" && (
              <>
                <span className={`${ts(sz)} text-white/60`}>posted</span>
                <span className="text-[11px] text-white/20">
                  on-chain. permanent.
                </span>
              </>
            )}
            {payStatus === "failed" && (
              <div className="flex flex-col items-center gap-2">
                <span className={`${ts(sz)} text-red-400/60`}>
                  {errorMsg ?? "broadcast failed"}
                </span>
                <button
                  onClick={onClose}
                  className={`${ts(sz)} text-white/30 hover:text-white/50`}
                >
                  close
                </button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
