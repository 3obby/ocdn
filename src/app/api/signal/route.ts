import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  rateLimit,
  requireWriteAuth,
  checkFeeSpike,
  errorResponse,
  log,
} from "@/lib/api-utils";
import { createSignalPayload } from "@/lib/protocol/create";
import type { SignalRef } from "@/lib/protocol/types";
import { loadPortalKey, reserveUtxo, releaseUtxo, markUtxoSpent } from "@/lib/bitcoin/wallet";
import { buildSignalTx, broadcastTx } from "@/lib/bitcoin/tx";
import { getRpc } from "@/lib/bitcoin/rpc";

export const dynamic = "force-dynamic";

const MAX_REFS = 10;
const MAX_TEXT_REF_LENGTH = 200;

export async function POST(request: Request) {
  const auth = requireWriteAuth(request);
  if (auth) return auth;

  const limited = rateLimit(request, "write");
  if (limited) return limited;

  let body: { refs?: unknown };
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const { refs } = body;
  if (!refs || !Array.isArray(refs) || refs.length === 0) {
    return errorResponse("refs is required and must be a non-empty array");
  }
  if (refs.length > MAX_REFS) {
    return errorResponse(`refs must not exceed ${MAX_REFS} items`);
  }

  const protocolRefs: SignalRef[] = [];
  for (const ref of refs) {
    if (!ref || typeof ref !== "object" || typeof ref.kind !== "string") {
      return errorResponse("each ref must have a 'kind' field");
    }
    if (ref.kind === "text") {
      if (!ref.value || typeof ref.value !== "string") {
        return errorResponse("text refs must have a non-empty 'value' string");
      }
      if (ref.value.length > MAX_TEXT_REF_LENGTH) {
        return errorResponse(`text ref value must not exceed ${MAX_TEXT_REF_LENGTH} characters`);
      }
      protocolRefs.push({ kind: "text", value: ref.value });
    } else if (ref.kind === "content") {
      if (!ref.hashPrefix || typeof ref.hashPrefix !== "string" || !/^[0-9a-f]+$/i.test(ref.hashPrefix)) {
        return errorResponse("content refs must have a valid hex 'hashPrefix'");
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

    const spiked = checkFeeSpike(feeRate);
    if (spiked) return spiked;

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

    const serializableRefs = refs.map((r: { kind: string; value?: string; hashPrefix?: string }) =>
      r.kind === "text"
        ? { kind: "text", value: r.value }
        : { kind: "content", hashPrefix: r.hashPrefix },
    );

    await prisma.pendingTx.create({
      data: {
        commitTxid: txid,
        txType: "signal",
        payload: { refs: serializableRefs },
        commitHex: txResult.hex,
        status: "revealed",
        feeRate,
        attempts: 1,
      },
    });

    log("info", "api/signal", "signal broadcast", { txid, refCount: refs.length, feeRate });

    return NextResponse.json({
      txid,
      fee: Number(txResult.fee),
      status: "revealed",
    }, { status: 201 });
  } catch (err: unknown) {
    if (utxoId !== null) {
      try { await releaseUtxo(utxoId); } catch { /* best effort */ }
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    log("error", "api/signal", message, { error: String(err) });
    return errorResponse(message, 500);
  }
}
