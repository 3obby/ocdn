import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, errorResponse } from "@/lib/api-utils";
import { createPostEnvelope } from "@/lib/protocol/create";
import { loadPortalKey, reserveUtxo, releaseUtxo, markUtxoSpent } from "@/lib/bitcoin/wallet";
import { buildCommitRevealTxs, broadcastCommitReveal } from "@/lib/bitcoin/tx";
import { getRpc } from "@/lib/bitcoin/rpc";

export const dynamic = "force-dynamic";

/**
 * POST /api/post
 *
 * Submit text + topic. Portal constructs the envelope, builds commit/reveal txs,
 * broadcasts, records PendingTx, and returns the content hash + status.
 *
 * Body: { content: string, topic?: string }
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "write");
  if (limited) return limited;

  let body: { content?: string; topic?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const { content, topic } = body;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return errorResponse("content is required and must be a non-empty string");
  }
  if (content.length > 50_000) {
    return errorResponse("content exceeds maximum length (50,000 bytes)");
  }

  let utxoId: number | null = null;

  try {
    const portal = loadPortalKey();
    const { envelope, contentHash } = createPostEnvelope(
      new Uint8Array(portal.privkey),
      content.trim(),
      topic?.trim() ?? "",
    );

    const contentHashHex = Buffer.from(contentHash).toString("hex");

    // Get current fee rate
    const rpc = getRpc();
    const feeEst = await rpc.estimateSmartFee(6);
    const feeRate = feeEst.feerate
      ? Math.ceil(feeEst.feerate * 1e8 / 1000) // BTC/kvB → sat/vB
      : 2; // fallback to 2 sat/vB on signet

    // Reserve a UTXO
    const utxo = await reserveUtxo(BigInt(10_000));
    utxoId = utxo.id;

    const txResult = buildCommitRevealTxs(
      portal.privkey,
      envelope,
      { txid: utxo.txid, vout: utxo.vout, amount: utxo.amount, scriptPubkey: utxo.scriptPubkey },
      feeRate,
    );

    // Broadcast
    const { commitTxid, revealTxid } = await broadcastCommitReveal(
      txResult.commitHex,
      txResult.revealHex,
    );

    // Mark UTXO as spent
    await markUtxoSpent(utxo.id, commitTxid);
    utxoId = null;

    // Record PendingTx
    await prisma.pendingTx.create({
      data: {
        commitTxid,
        revealTxid,
        txType: "post",
        payload: { contentHash: contentHashHex, topic: topic?.trim() ?? "" },
        status: "revealed",
        feeRate,
        attempts: 1,
      },
    });

    return NextResponse.json({
      contentHash: contentHashHex,
      commitTxid,
      revealTxid,
      status: "revealed",
      totalFee: Number(txResult.totalFee),
    }, { status: 201 });
  } catch (err: unknown) {
    if (utxoId !== null) {
      try { await releaseUtxo(utxoId); } catch { /* best effort */ }
    }
    console.error("POST /api/post error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
