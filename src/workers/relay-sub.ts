/**
 * Relay subscriber: ingests NIP-POOL + NIP-RECEIPT + other protocol events
 * from configured Nostr relays into Postgres.
 */

import { prisma } from "@/lib/db";
import { subscribeProtocolEvents } from "@/lib/nostr/relay";
import { type NostrEvent, NIP_KINDS } from "@/lib/nostr/types";
import { parsePoolEvent } from "@/lib/nostr/pool";
import { parseReceiptEvent } from "@/lib/nostr/receipt";
import { parseSettleEvent } from "@/lib/nostr/settle";
import { parsePreserveEvent } from "@/lib/nostr/preserve";
import { parseOfferEvent } from "@/lib/nostr/offer";
import { parseClearingEvent } from "@/lib/nostr/clearing";
import { netAfterRoyalty } from "@/lib/royalty";

/** Store raw event (sacred, append-only) */
async function storeRawEvent(event: NostrEvent) {
  await prisma.nostrEvent.upsert({
    where: { id: event.id },
    update: {},
    create: {
      id: event.id,
      kind: event.kind,
      pubkey: event.pubkey,
      createdAt: event.created_at,
      content: event.content,
      tags: event.tags,
      sig: event.sig,
    },
  });
}

/** Get cumulative funded volume for royalty calculation */
async function getCumulativeVolume(): Promise<bigint> {
  const result = await prisma.pool.aggregate({ _sum: { totalFunded: true } });
  return result._sum.totalFunded ?? 0n;
}

/** Process a pool credit event */
async function handlePoolEvent(event: NostrEvent) {
  const credit = parsePoolEvent(event);
  if (!credit) return;

  const cumVol = await getCumulativeVolume();
  const net = netAfterRoyalty(credit.sats, cumVol);

  await prisma.$transaction([
    prisma.pool.upsert({
      where: { hash: credit.contentHash },
      update: {
        balance: { increment: net },
        totalFunded: { increment: credit.sats },
        funderCount: { increment: 1 },
      },
      create: {
        hash: credit.contentHash,
        balance: net,
        totalFunded: credit.sats,
        funderCount: 1,
      },
    }),
    prisma.poolFunder.create({
      data: {
        poolHash: credit.contentHash,
        pubkey: credit.funderPubkey,
        sats: credit.sats,
        eventId: credit.eventId,
      },
    }),
  ]);
}

/** Process a receipt event */
async function handleReceiptEvent(event: NostrEvent) {
  const receipt = parseReceiptEvent(event);
  if (!receipt) return;

  // Ensure pool exists
  await prisma.pool.upsert({
    where: { hash: receipt.contentHash },
    update: {},
    create: { hash: receipt.contentHash },
  });

  await prisma.receipt.upsert({
    where: { eventId: receipt.eventId },
    update: {},
    create: {
      eventId: receipt.eventId,
      contentHash: receipt.contentHash,
      hostPubkey: receipt.hostPubkey,
      clientPubkey: receipt.clientPubkey,
      priceSats: receipt.priceSats,
      epoch: receipt.epoch,
      responseHash: receipt.responseHash,
      receiptToken: receipt.receiptToken,
      indexPubkey: receipt.indexPubkey,
    },
  });
}

/** Process a settlement event */
async function handleSettleEvent(event: NostrEvent) {
  const settle = parseSettleEvent(event);
  if (!settle) return;

  await prisma.settlement.upsert({
    where: {
      epoch_settlerPubkey: {
        epoch: settle.epoch,
        settlerPubkey: settle.settlerPubkey,
      },
    },
    update: {},
    create: {
      eventId: settle.eventId,
      epoch: settle.epoch,
      settlerPubkey: settle.settlerPubkey,
      totalRewarded: settle.rewardSats,
      totalRoyalty: 0n,
      receiptCount: settle.receiptCount,
      lines: {
        create: {
          contentHash: settle.contentHash,
          hostPubkey: settle.hostPubkey,
          rewardSats: settle.rewardSats,
        },
      },
    },
  });
}

/** Process a preserve event */
async function handlePreserveEvent(event: NostrEvent) {
  const preserve = parsePreserveEvent(event);
  if (!preserve) return;

  await prisma.preserveOrder.upsert({
    where: { eventId: preserve.eventId },
    update: {},
    create: {
      eventId: preserve.eventId,
      contentHash: preserve.contentHash,
      funderPubkey: preserve.funderPubkey,
      tier: preserve.tier,
      replicas: preserve.replicas,
      jurisdictions: preserve.jurisdictions,
      durationEpochs: preserve.durationEpochs,
      maxPriceSats: preserve.maxPriceSats,
      escrowProof: preserve.escrowProof,
    },
  });
}

/** Process an offer event */
async function handleOfferEvent(event: NostrEvent) {
  const offer = parseOfferEvent(event);
  if (!offer) return;

  await prisma.hostOffer.upsert({
    where: { eventId: offer.eventId },
    update: {},
    create: {
      eventId: offer.eventId,
      hostPubkey: offer.hostPubkey,
      contentHash: offer.contentHash,
      replicas: offer.replicas,
      regions: offer.regions,
      priceSats: offer.priceSats,
      bondSats: offer.bondSats,
      bondProof: offer.bondProof,
      durationEpochs: offer.durationEpochs,
    },
  });
}

const NIP57_ZAP_RECEIPT_KIND = 9735;

/** Process a NIP-57 Zap receipt — credit pool if it targets a content hash */
async function handleZapEvent(event: NostrEvent) {
  try {
    // The zap request is in the "description" tag
    const descriptionTag = event.tags.find((t) => t[0] === "description");
    if (!descriptionTag?.[1]) return;

    let zapRequest: { tags?: string[][] };
    try {
      zapRequest = JSON.parse(descriptionTag[1]);
    } catch {
      return; // Malformed zap request
    }

    if (!zapRequest.tags) return;

    // Look for an "r" tag in the zap request pointing to a content hash
    const rTag = zapRequest.tags.find(
      (t: string[]) => t[0] === "r" && /^[0-9a-f]{64}$/.test(t[1])
    );
    if (!rTag) return; // Not a content-targeted zap

    const contentHash = rTag[1];

    // Extract amount from bolt11 tag
    const bolt11Tag = event.tags.find((t) => t[0] === "bolt11");
    const bolt11 = bolt11Tag?.[1] ?? "";
    const sats = parseBolt11Amount(bolt11);
    if (!sats || sats <= 0n) return;

    const cumVol = await getCumulativeVolume();
    const net = netAfterRoyalty(sats, cumVol);

    await prisma.pool.upsert({
      where: { hash: contentHash },
      update: {
        balance: { increment: net },
        totalFunded: { increment: sats },
        funderCount: { increment: 1 },
      },
      create: {
        hash: contentHash,
        balance: net,
        totalFunded: sats,
        funderCount: 1,
      },
    });

    console.log(`[relay-sub] Zap credited ${sats} sats to pool ${contentHash.slice(0, 12)}...`);
  } catch (err) {
    console.error("[relay-sub] Error processing zap:", err);
  }
}

/**
 * Parse a bolt11 invoice to extract amount in sats.
 * Bolt11 amounts are encoded after 'lnbc' prefix with a multiplier suffix:
 * m = milli (0.001), u = micro (0.000001), n = nano, p = pico
 */
function parseBolt11Amount(bolt11: string): bigint | null {
  if (!bolt11) return null;
  const match = bolt11.match(/^lnbc(\d+)([munp]?)1/i);
  if (!match) return null;

  const amount = BigInt(match[1]);
  const suffix = match[2].toLowerCase();

  // Convert to sats (1 BTC = 100_000_000 sats)
  switch (suffix) {
    case "":   return amount * 100_000_000n; // BTC
    case "m":  return amount * 100_000n;     // mBTC
    case "u":  return amount * 100n;         // uBTC (microsats → sats)
    case "n":  return amount / 10n;          // nBTC
    case "p":  return amount / 10_000n;      // pBTC
    default:   return null;
  }
}

/** Route event to appropriate handler */
async function handleEvent(event: NostrEvent) {
  await storeRawEvent(event);

  switch (event.kind) {
    case NIP_KINDS.pool:
      await handlePoolEvent(event);
      break;
    case NIP_KINDS.receipt:
      await handleReceiptEvent(event);
      break;
    case NIP_KINDS.settle:
      await handleSettleEvent(event);
      break;
    case NIP_KINDS.preserve:
      await handlePreserveEvent(event);
      break;
    case NIP_KINDS.offer:
      await handleOfferEvent(event);
      break;
    case NIP_KINDS.clearing:
      // Clearing events handled by clearing worker
      break;
    case NIP57_ZAP_RECEIPT_KIND:
      await handleZapEvent(event);
      break;
  }
}

/** Start the relay subscription worker */
export async function startRelaySubscriber() {
  console.log("[relay-sub] Starting protocol event subscription...");

  // Get last ingested timestamp for resumption
  const latest = await prisma.nostrEvent.findFirst({
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const since = latest?.createdAt ?? Math.floor(Date.now() / 1000) - 86400;

  const subs = await subscribeProtocolEvents(async (event) => {
    try {
      await handleEvent(event);
    } catch (err) {
      console.error(`[relay-sub] Error processing event ${event.id}:`, err);
    }
  }, since);

  console.log(`[relay-sub] Subscribed to ${subs.length} relays`);
  return subs;
}
