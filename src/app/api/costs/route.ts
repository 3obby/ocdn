import { NextResponse } from "next/server";
import { rateLimit, errorResponse, log } from "@/lib/api-utils";
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
      const rpc = getRpc();
      const feeEst = await rpc.estimateSmartFee(6);
      feeRate = feeEst.feerate
        ? Math.ceil(feeEst.feerate * 1e8 / 1000)
        : 2;
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

    return NextResponse.json({
      feeRate,
      post: {
        commitVsize: postCost.commitVsize,
        revealVsize: postCost.revealVsize,
        totalVsize: postCost.totalVsize,
        totalFeeSats: Number(postCost.totalFeeSats),
      },
      reply: {
        commitVsize: replyCost.commitVsize,
        revealVsize: replyCost.revealVsize,
        totalVsize: replyCost.totalVsize,
        totalFeeSats: Number(replyCost.totalFeeSats),
      },
      burn: {
        vsize: burnCost.vsize,
        feeSats: Number(burnCost.feeSats),
        note: "fee shown is the tx mining fee; the 'amount' you specify is the additional sats burned",
      },
      signal: {
        vsize: signalCost.vsize,
        feeSats: Number(signalCost.feeSats),
      },
    });
  } catch (err) {
    log("error", "api/costs", "cost estimate failed", { error: String(err) });
    return errorResponse("Internal server error", 500);
  }
}
