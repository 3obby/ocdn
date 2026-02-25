import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, errorResponse } from "@/lib/api-utils";
import { createReplyEnvelope } from "@/lib/protocol/create";
import { loadPortalKey, reserveUtxo, releaseUtxo, markUtxoSpent } from "@/lib/bitcoin/wallet";
import { buildCommitRevealTxs, broadcastCommitReveal } from "@/lib/bitcoin/tx";
import { getRpc } from "@/lib/bitcoin/rpc";

export const dynamic = "force-dynamic";

/**
 * POST /api/reply
 *
 * Submit text + parent_hash. Portal constructs the reply envelope,
 * builds commit/reveal txs, broadcasts, records PendingTx.
 *
 * Body: { content: string, parentHash: string }
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "write");
  if (limited) return limited;

  let body: { content?: string; parentHash?: string };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const { content, parentHash } = body;
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return errorResponse("content is required and must be a non-empty string");
  }
  if (content.length > 50_000) {
    return errorResponse("content exceeds maximum length (50,000 bytes)");
  }
  if (!parentHash || typeof parentHash !== "string" || parentHash.length !== 64) {
    return errorResponse("parentHash is required and must be a 64-character hex string");
  }

  let utxoId: number | null = null;

  try {
    const portal = loadPortalKey();
    const parentHashBytes = new Uint8Array(Buffer.from(parentHash, "hex"));

    const { envelope, contentHash } = createReplyEnvelope(
      new Uint8Array(portal.privkey),
      content.trim(),
      parentHashBytes,
    );

    const contentHashHex = Buffer.from(contentHash).toString("hex");

    const rpc = getRpc();
    const feeEst = await rpc.estimateSmartFee(6);
    const feeRate = feeEst.feerate
      ? Math.ceil(feeEst.feerate * 1e8 / 1000)
      : 2;

    const utxo = await reserveUtxo(BigInt(10_000));
    utxoId = utxo.id;

    const txResult = buildCommitRevealTxs(
      portal.privkey,
      envelope,
      { txid: utxo.txid, vout: utxo.vout, amount: utxo.amount, scriptPubkey: utxo.scriptPubkey },
      feeRate,
    );

    const { commitTxid, revealTxid } = await broadcastCommitReveal(
      txResult.commitHex,
      txResult.revealHex,
    );

    await markUtxoSpent(utxo.id, commitTxid);
    utxoId = null;

    await prisma.pendingTx.create({
      data: {
        commitTxid,
        revealTxid,
        txType: "reply",
        payload: { contentHash: contentHashHex, parentHash },
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
    console.error("POST /api/reply error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
