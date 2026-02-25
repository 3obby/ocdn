import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, errorResponse } from "@/lib/api-utils";
import { createSignalPayload } from "@/lib/protocol/create";
import type { SignalRef } from "@/lib/protocol/types";
import { loadPortalKey, reserveUtxo, releaseUtxo, markUtxoSpent } from "@/lib/bitcoin/wallet";
import { buildSignalTx, broadcastTx } from "@/lib/bitcoin/tx";
import { getRpc } from "@/lib/bitcoin/rpc";

export const dynamic = "force-dynamic";

/**
 * POST /api/signal
 *
 * Submit an array of refs for a signal transaction.
 * Each ref is { kind: "text", value: string } or { kind: "content", hashPrefix: string (hex) }.
 *
 * Body: { refs: Array<{ kind: "text", value: string } | { kind: "content", hashPrefix: string }> }
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "write");
  if (limited) return limited;

  let body: { refs?: Array<{ kind: string; value?: string; hashPrefix?: string }> };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const { refs } = body;
  if (!refs || !Array.isArray(refs) || refs.length === 0) {
    return errorResponse("refs is required and must be a non-empty array");
  }

  // Validate and convert refs
  const protocolRefs: SignalRef[] = [];
  for (const ref of refs) {
    if (ref.kind === "text") {
      if (!ref.value || typeof ref.value !== "string") {
        return errorResponse("text refs must have a non-empty 'value' string");
      }
      protocolRefs.push({ kind: "text", value: ref.value });
    } else if (ref.kind === "content") {
      if (!ref.hashPrefix || typeof ref.hashPrefix !== "string") {
        return errorResponse("content refs must have a 'hashPrefix' hex string");
      }
      protocolRefs.push({
        kind: "content",
        hashPrefix: new Uint8Array(Buffer.from(ref.hashPrefix, "hex")),
      });
    } else {
      return errorResponse(`Unknown ref kind: ${ref.kind}. Must be 'text' or 'content'.`);
    }
  }

  let utxoId: number | null = null;

  try {
    const portal = loadPortalKey();
    const payload = createSignalPayload(protocolRefs);

    const rpc = getRpc();
    const feeEst = await rpc.estimateSmartFee(6);
    const feeRate = feeEst.feerate
      ? Math.ceil(feeEst.feerate * 1e8 / 1000)
      : 2;

    const utxo = await reserveUtxo(BigInt(5_000));
    utxoId = utxo.id;

    const txResult = buildSignalTx(
      portal.privkey,
      payload,
      { txid: utxo.txid, vout: utxo.vout, amount: utxo.amount, scriptPubkey: utxo.scriptPubkey },
      feeRate,
    );

    const txid = await broadcastTx(txResult.hex);

    await markUtxoSpent(utxo.id, txid);
    utxoId = null;

    // Store refs in serializable form for the PendingTx payload
    const serializableRefs = refs.map((r) =>
      r.kind === "text"
        ? { kind: "text", value: r.value }
        : { kind: "content", hashPrefix: r.hashPrefix },
    );

    await prisma.pendingTx.create({
      data: {
        commitTxid: txid,
        txType: "signal",
        payload: { refs: serializableRefs },
        status: "revealed",
        feeRate,
        attempts: 1,
      },
    });

    return NextResponse.json({
      txid,
      fee: Number(txResult.fee),
      status: "revealed",
    }, { status: 201 });
  } catch (err: unknown) {
    if (utxoId !== null) {
      try { await releaseUtxo(utxoId); } catch { /* best effort */ }
    }
    console.error("POST /api/signal error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
