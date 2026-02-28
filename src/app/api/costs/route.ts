import { NextResponse } from "next/server";
import { rateLimit, errorResponse, log, computeRake } from "@/lib/api-utils";
import { createPostEnvelope, createReplyEnvelope } from "@/lib/protocol/create";
import { generateNonce, generateKeyPair } from "@/lib/protocol/crypto";
import { HASH_LENGTH } from "@/lib/protocol/constants";
import {
  estimateCommitRevealCost,
  estimateBurnCost,
  estimateSignalCost,
} from "@/lib/bitcoin/tx";
import { getRpc } from "@/lib/bitcoin/rpc";

export const dynamic = "force-dynamic";

/**
 * GET /api/costs
 *
 * Returns the expected sats cost for each action type at the current feerate.
 * Query params:
 *   content=<string>    optional content to estimate post/reply size (default: 280 chars)
 *   feeRate=<number>    override fee rate in sat/vB
 */
export async function GET(request: Request) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const contentParam = searchParams.get("content");
  const feeRateParam = searchParams.get("feeRate");

  try {
    let feeRate: number;

    if (feeRateParam) {
      feeRate = parseFloat(feeRateParam);
      if (isNaN(feeRate) || feeRate <= 0) {
        return errorResponse("feeRate must be a positive number");
      }
    } else {
      try {
        const rpc = getRpc();
        const feeEst = await rpc.estimateSmartFee(6);
        feeRate = feeEst.feerate
          ? Math.ceil(feeEst.feerate * 1e8 / 1000)
          : 2;
      } catch {
        feeRate = 2;
      }
    }

    const sampleContent = contentParam ?? "A".repeat(280);
    const sampleKey = generateKeyPair();

    // Post cost estimate
    const { envelope: postEnvelope } = createPostEnvelope(
      sampleKey.privkey,
      sampleContent,
      "sample-topic",
    );
    const postCost = estimateCommitRevealCost(postEnvelope, feeRate);

    // Reply cost estimate
    const dummyParentHash = new Uint8Array(HASH_LENGTH);
    const { envelope: replyEnvelope } = createReplyEnvelope(
      sampleKey.privkey,
      sampleContent,
      dummyParentHash,
    );
    const replyCost = estimateCommitRevealCost(replyEnvelope, feeRate);

    // Burn cost estimate
    const burnCost = estimateBurnCost(feeRate);

    // Signal cost estimate
    const signalCost = estimateSignalCost(feeRate);

    const rake = computeRake(feeRate);

    return NextResponse.json({
      feeRate,
      rake,
      post: {
        minerFee: Number(postCost.totalFeeSats),
        rake,
        totalSats: Number(postCost.totalFeeSats) + rake,
      },
      reply: {
        minerFee: Number(replyCost.totalFeeSats),
        rake,
        totalSats: Number(replyCost.totalFeeSats) + rake,
      },
      burn: {
        minerFee: Number(burnCost.feeSats),
        rake,
        totalSats: Number(burnCost.feeSats) + rake,
        note: "total excludes the burn amount itself",
      },
      signal: {
        minerFee: Number(signalCost.feeSats),
        rake,
        totalSats: Number(signalCost.feeSats) + rake,
      },
    });
  } catch (err) {
    log("error", "api/costs", "cost estimate failed", { error: String(err) });
    return errorResponse("Internal server error", 500);
  }
}
