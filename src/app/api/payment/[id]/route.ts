import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { rateLimit, errorResponse, log } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

const MEMPOOL_API = "https://mempool.space/api";

/**
 * Check the blockchain for a payment to the given address via mempool.space API.
 * Returns both confirmed and unconfirmed UTXOs.
 */
async function checkForPayment(
  address: string,
  expectedSats: number,
): Promise<{ txid: string; vout: number; amount: number; confirmed: boolean } | null> {
  try {
    const res = await fetch(`${MEMPOOL_API}/address/${address}/utxo`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      log("warn", "payment-check", `mempool.space returned ${res.status} for ${address}`);
      return null;
    }
    const utxos: Array<{
      txid: string;
      vout: number;
      value: number;
      status: { confirmed: boolean; block_height?: number };
    }> = await res.json();

    for (const u of utxos) {
      if (u.value >= expectedSats) {
        return {
          txid: u.txid,
          vout: u.vout,
          amount: u.value,
          confirmed: u.status.confirmed,
        };
      }
    }
  } catch (err) {
    log("warn", "payment-check", "mempool.space check failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
  return null;
}

/**
 * GET /api/payment/[id]
 *
 * Returns the current status of a payment request.
 * When status is "pending", actively checks the blockchain for the payment.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { id } = await params;

  const payment = await prisma.paymentRequest.findUnique({
    where: { id },
  });

  if (!payment) {
    return errorResponse("Payment request not found", 404);
  }

  // Expire old requests
  if (payment.status === "pending" && payment.expiresAt < new Date()) {
    await prisma.paymentRequest.update({
      where: { id },
      data: { status: "expired" },
    });
    return NextResponse.json({
      id: payment.id,
      status: "expired",
      amountSats: payment.amountSats,
      address: payment.paymentAddress,
    });
  }

  // Actively check blockchain when pending
  if (payment.status === "pending") {
    const found = await checkForPayment(
      payment.paymentAddress,
      payment.amountSats,
    );

    if (found) {
      await prisma.paymentRequest.update({
        where: { id },
        data: {
          status: "detected",
          paidTxid: found.txid,
          paidVout: found.vout,
        },
      });

      log("info", "payment-check", "payment detected", {
        id: payment.id,
        txid: found.txid,
        amount: found.amount,
        confirmed: found.confirmed,
      });

      return NextResponse.json({
        id: payment.id,
        status: "detected",
        amountSats: payment.amountSats,
        address: payment.paymentAddress,
        paidTxid: found.txid,
      });
    }
  }

  return NextResponse.json({
    id: payment.id,
    status: payment.status,
    amountSats: payment.amountSats,
    address: payment.paymentAddress,
    contentHash: payment.contentHash,
    paidTxid: payment.paidTxid,
  });
}
