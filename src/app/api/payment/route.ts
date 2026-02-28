import { NextResponse } from "next/server";
import * as bitcoin from "bitcoinjs-lib";
import * as ecc from "@bitcoinerlab/secp256k1";
import { schnorr } from "@noble/curves/secp256k1.js";
import { prisma } from "@/lib/db";
import { NETWORK } from "@/lib/bitcoin/wallet";
import { getRpc } from "@/lib/bitcoin/rpc";
import { createPostEnvelope, createReplyEnvelope } from "@/lib/protocol/create";
import { generateKeyPair } from "@/lib/protocol/crypto";
import {
  estimateCommitRevealCost,
  estimateBurnCost,
} from "@/lib/bitcoin/tx";
import {
  rateLimit,
  validateContent,
  validateTopic,
  validateHex,
  checkFeeSpike,
  errorResponse,
  log,
  computeRake,
  PAYMENT_EXPIRY_MS,
} from "@/lib/api-utils";
import { HASH_LENGTH } from "@/lib/protocol/constants";

bitcoin.initEccLib(ecc);

export const dynamic = "force-dynamic";

function generatePaymentAddress(): { privkeyHex: string; address: string } {
  const privkey = Buffer.from(schnorr.utils.randomSecretKey());
  const xOnlyPubkey = Buffer.from(schnorr.getPublicKey(privkey));
  const { address } = bitcoin.payments.p2tr({
    internalPubkey: xOnlyPubkey,
    network: NETWORK,
  });
  return { privkeyHex: privkey.toString("hex"), address: address! };
}

/**
 * POST /api/payment
 *
 * Creates a payment request. Returns an address + amount for the user to pay.
 * Body: { actionType: "post"|"reply"|"burn", content, topic?, parentHash?, burnAmount? }
 */
export async function POST(request: Request) {
  const limited = rateLimit(request, "write");
  if (limited) return limited;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const actionType = body.actionType as string;
  if (!["post", "reply", "burn"].includes(actionType)) {
    return errorResponse("actionType must be post, reply, or burn");
  }

  const contentResult = actionType !== "burn"
    ? validateContent(body.content)
    : { ok: true as const, value: "" };
  if (!contentResult.ok) return errorResponse(contentResult.error);

  if (actionType === "post") {
    const topicResult = validateTopic(body.topic);
    if (!topicResult.ok) return errorResponse(topicResult.error);
  }

  if (actionType === "reply") {
    const parentResult = validateHex(body.parentHash, "parentHash", 64);
    if (!parentResult.ok) return errorResponse(parentResult.error);
  }

  if (actionType === "burn") {
    const targetResult = validateHex(body.targetHash, "targetHash", 64);
    if (!targetResult.ok) return errorResponse(targetResult.error);
    const amt = Number(body.burnAmount);
    if (!amt || amt < 546 || amt > 10_000_000) {
      return errorResponse("burnAmount must be between 546 and 10,000,000 sats");
    }
  }

  try {
    let feeRate: number;
    try {
      const rpc = getRpc();
      const feeEst = await rpc.estimateSmartFee(6);
      feeRate = feeEst.feerate
        ? Math.ceil((feeEst.feerate * 1e8) / 1000)
        : 2;
    } catch {
      feeRate = 2;
    }

    const spiked = checkFeeSpike(feeRate);
    if (spiked) return spiked;

    let feeSats: number;

    if (actionType === "post" || actionType === "reply") {
      const sampleKey = generateKeyPair();
      const content = contentResult.value;

      if (actionType === "post") {
        const topic = (body.topic as string) ?? "";
        const { envelope } = createPostEnvelope(sampleKey.privkey, content, topic);
        const est = estimateCommitRevealCost(envelope, feeRate);
        feeSats = Number(est.totalFeeSats);
      } else {
        const dummyParent = new Uint8Array(HASH_LENGTH);
        const { envelope } = createReplyEnvelope(sampleKey.privkey, content, dummyParent);
        const est = estimateCommitRevealCost(envelope, feeRate);
        feeSats = Number(est.totalFeeSats);
      }
    } else {
      const est = estimateBurnCost(feeRate);
      feeSats = Number(est.feeSats);
    }

    const rake = computeRake(feeRate);
    const burnExtra = actionType === "burn" ? Number(body.burnAmount) : 0;
    const amountSats = feeSats + rake + burnExtra;

    const { privkeyHex, address } = generatePaymentAddress();

    const expiresAt = new Date(Date.now() + PAYMENT_EXPIRY_MS);

    let actionPayload: Record<string, string | number>;
    if (actionType === "post") {
      actionPayload = {
        actionType,
        content: contentResult.value,
        topic: (body.topic as string) ?? "",
      };
    } else if (actionType === "reply") {
      actionPayload = {
        actionType,
        content: contentResult.value,
        parentHash: (body.parentHash as string).toLowerCase(),
      };
    } else {
      actionPayload = {
        actionType,
        targetHash: (body.targetHash as string).toLowerCase(),
        burnAmount: Number(body.burnAmount),
      };
    }

    const payment = await prisma.paymentRequest.create({
      data: {
        actionType,
        actionPayload,
        paymentAddress: address,
        paymentKeyHex: privkeyHex,
        amountSats,
        feeSats,
        rakeSats: rake,
        status: "pending",
        expiresAt,
      },
    });

    const amountBtc = (amountSats / 1e8).toFixed(8);
    const bitcoinUri = `bitcoin:${address}?amount=${amountBtc}&label=OCDN%20${actionType}`;

    log("info", "api/payment", "payment request created", {
      id: payment.id,
      actionType,
      amountSats,
      address,
    });

    return NextResponse.json(
      {
        id: payment.id,
        address,
        amountSats,
        feeSats,
        rakeSats: rake,
        bitcoinUri,
        expiresAt: expiresAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    log("error", "api/payment", message, {
      stack: err instanceof Error ? err.stack : String(err),
    });
    return errorResponse(message, 500);
  }
}
