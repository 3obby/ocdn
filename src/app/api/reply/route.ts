import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  rateLimit,
  requireWriteAuth,
  validateContent,
  validateHex,
  checkFeeSpike,
  errorResponse,
  log,
} from "@/lib/api-utils";
import { createReplyEnvelope } from "@/lib/protocol/create";
import { loadPortalKey, reserveUtxo, releaseUtxo, markUtxoSpent } from "@/lib/bitcoin/wallet";
import { buildCommitRevealTxs, broadcastCommitReveal } from "@/lib/bitcoin/tx";
import { getRpc } from "@/lib/bitcoin/rpc";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = requireWriteAuth(request);
  if (auth) return auth;

  const limited = rateLimit(request, "write");
  if (limited) return limited;

  let body: { content?: unknown; parentHash?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const contentResult = validateContent(body.content);
  if (!contentResult.ok) return errorResponse(contentResult.error);

  const hashResult = validateHex(body.parentHash, "parentHash", 64);
  if (!hashResult.ok) return errorResponse(hashResult.error);

  let utxoId: number | null = null;

  try {
    const portal = loadPortalKey();
    const parentHashBytes = new Uint8Array(Buffer.from(hashResult.value, "hex"));

    const { envelope, contentHash } = createReplyEnvelope(
      new Uint8Array(portal.privkey),
      contentResult.value,
      parentHashBytes,
    );

    const contentHashHex = Buffer.from(contentHash).toString("hex");

    const rpc = getRpc();
    const feeEst = await rpc.estimateSmartFee(6);
    const feeRate = feeEst.feerate
      ? Math.ceil(feeEst.feerate * 1e8 / 1000)
      : 2;

    const spiked = checkFeeSpike(feeRate);
    if (spiked) return spiked;

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
        payload: { contentHash: contentHashHex, parentHash: hashResult.value },
        status: "revealed",
        feeRate,
        attempts: 1,
      },
    });

    log("info", "api/reply", "reply broadcast", { contentHash: contentHashHex, parentHash: hashResult.value, commitTxid, revealTxid, feeRate });

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
    const message = err instanceof Error ? err.message : "Internal server error";
    log("error", "api/reply", message, { error: String(err) });
    return errorResponse(message, 500);
  }
}
