import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  rateLimit,
  requireWriteAuth,
  validateHex,
  checkFeeSpike,
  errorResponse,
  log,
} from "@/lib/api-utils";
import { createBurnPayload } from "@/lib/protocol/create";
import { loadPortalKey, reserveUtxo, releaseUtxo, markUtxoSpent } from "@/lib/bitcoin/wallet";
import { buildBurnTx, broadcastTx } from "@/lib/bitcoin/tx";
import { getRpc } from "@/lib/bitcoin/rpc";

export const dynamic = "force-dynamic";

const MAX_BURN_SATS = 10_000_000;

export async function POST(request: Request) {
  const auth = requireWriteAuth(request);
  if (auth) return auth;

  const limited = rateLimit(request, "write");
  if (limited) return limited;

  let body: { targetHash?: unknown; amount?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const hashResult = validateHex(body.targetHash, "targetHash", 64);
  if (!hashResult.ok) return errorResponse(hashResult.error);

  const amount = body.amount;
  if (!amount || typeof amount !== "number" || !Number.isFinite(amount) || amount < 546) {
    return errorResponse("amount is required and must be >= 546 sats");
  }
  if (amount > MAX_BURN_SATS) {
    return errorResponse(`amount must not exceed ${MAX_BURN_SATS} sats`);
  }

  let utxoId: number | null = null;

  try {
    const portal = loadPortalKey();
    const targetHashBytes = new Uint8Array(Buffer.from(hashResult.value, "hex"));
    const payload = createBurnPayload(targetHashBytes);

    const rpc = getRpc();
    const feeEst = await rpc.estimateSmartFee(6);
    const feeRate = feeEst.feerate
      ? Math.ceil(feeEst.feerate * 1e8 / 1000)
      : 2;

    const spiked = checkFeeSpike(feeRate);
    if (spiked) return spiked;

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
        payload: { targetHash: hashResult.value, amount },
        status: "revealed",
        feeRate,
        attempts: 1,
      },
    });

    log("info", "api/burn", "burn broadcast", { txid, targetHash: hashResult.value, amount, feeRate });

    return NextResponse.json({
      txid,
      targetHash: hashResult.value,
      amount,
      fee: Number(txResult.fee),
      status: "revealed",
    }, { status: 201 });
  } catch (err: unknown) {
    if (utxoId !== null) {
      try { await releaseUtxo(utxoId); } catch { /* best effort */ }
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    log("error", "api/burn", message, { error: String(err) });
    return errorResponse(message, 500);
  }
}
