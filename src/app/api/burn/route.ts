import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, errorResponse } from "@/lib/api-utils";
import { createBurnPayload } from "@/lib/protocol/create";
import { loadPortalKey, reserveUtxo, releaseUtxo, markUtxoSpent } from "@/lib/bitcoin/wallet";
import { buildBurnTx, broadcastTx } from "@/lib/bitcoin/tx";
import { getRpc } from "@/lib/bitcoin/rpc";

export const dynamic = "force-dynamic";

/**
 * POST /api/burn
 *
 * Submit target_hash + desired burn amount.
 * Portal constructs the OP_RETURN burn tx, broadcasts, records PendingTx.
 *
 * Body: { targetHash: string, amount: number }
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "write");
  if (limited) return limited;

  let body: { targetHash?: string; amount?: number };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const { targetHash, amount } = body;
  if (!targetHash || typeof targetHash !== "string" || targetHash.length !== 64) {
    return errorResponse("targetHash is required and must be a 64-character hex string");
  }
  if (!amount || typeof amount !== "number" || amount < 546) {
    return errorResponse("amount is required and must be >= 546 sats");
  }

  let utxoId: number | null = null;

  try {
    const portal = loadPortalKey();
    const targetHashBytes = new Uint8Array(Buffer.from(targetHash, "hex"));
    const payload = createBurnPayload(targetHashBytes);

    const rpc = getRpc();
    const feeEst = await rpc.estimateSmartFee(6);
    const feeRate = feeEst.feerate
      ? Math.ceil(feeEst.feerate * 1e8 / 1000)
      : 2;

    const desiredBurn = BigInt(amount);
    const utxo = await reserveUtxo(desiredBurn + BigInt(1_000));
    utxoId = utxo.id;

    const txResult = buildBurnTx(
      portal.privkey,
      payload,
      { txid: utxo.txid, vout: utxo.vout, amount: utxo.amount, scriptPubkey: utxo.scriptPubkey },
      feeRate,
      desiredBurn,
    );

    const txid = await broadcastTx(txResult.hex);

    await markUtxoSpent(utxo.id, txid);
    utxoId = null;

    await prisma.pendingTx.create({
      data: {
        commitTxid: txid,
        txType: "burn",
        payload: { targetHash, amount },
        status: "revealed",
        feeRate,
        attempts: 1,
      },
    });

    return NextResponse.json({
      txid,
      targetHash,
      amount,
      fee: Number(txResult.fee),
      status: "revealed",
    }, { status: 201 });
  } catch (err: unknown) {
    if (utxoId !== null) {
      try { await releaseUtxo(utxoId); } catch { /* best effort */ }
    }
    console.error("POST /api/burn error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return errorResponse(message, 500);
  }
}
