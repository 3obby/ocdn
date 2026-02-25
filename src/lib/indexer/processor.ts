import type { PrismaClient } from "../../generated/prisma/client";
import type { BlockVerbose } from "../bitcoin/rpc";
import { TYPE_POST, TYPE_REPLY, TYPE_BURN, TYPE_SIGNAL } from "../protocol/constants";
import type { PostEnvelope, ReplyEnvelope, BurnPayload, SignalPayload } from "../protocol/types";
import {
  detectBlockItems,
  toHex,
  normalizeTopic,
  normalizedTopicHash,
  type DetectedEnvelope,
  type DetectedOpReturn,
} from "./detector";

// ═══ TYPES ═══

export interface ProcessedBlock {
  height: number;
  hash: string;
  posts: number;
  burns: number;
  signals: number;
}

// ═══ BLOCK PROCESSOR ═══

/**
 * Process a single block: detect OCDN protocol transactions, write to DB,
 * and update aggregates.  Idempotent — safe to call again after a crash.
 */
export async function processBlock(
  block: BlockVerbose,
  prisma: PrismaClient,
): Promise<ProcessedBlock> {
  const result: ProcessedBlock = {
    height: block.height,
    hash: block.hash,
    posts: 0,
    burns: 0,
    signals: 0,
  };

  const items = detectBlockItems(block.tx);
  const hasData = items.envelopes.length > 0 || items.opReturns.length > 0;
  if (!hasData) return result;

  const blockTimestamp = new Date(block.time * 1000);

  // Create the IndexedBlock record (idempotent via upsert)
  await prisma.indexedBlock.upsert({
    where: { hash: block.hash },
    create: {
      hash: block.hash,
      height: block.height,
      prevHash: block.previousblockhash ?? "",
      timestamp: blockTimestamp,
    },
    update: {},
  });

  // Phase 1: index all POSTs (so same-block replies and burns can reference them)
  for (const item of items.envelopes) {
    if (!item.valid || item.envelope.type !== TYPE_POST) continue;
    await indexPost(item, block, blockTimestamp, prisma);
    result.posts++;
  }

  // Phase 2: index all REPLYs
  for (const item of items.envelopes) {
    if (!item.valid || item.envelope.type !== TYPE_REPLY) continue;
    await indexReply(item, block, blockTimestamp, prisma);
    result.posts++;
  }

  // Phase 3: index OP_RETURN payloads (burns, signals)
  for (const item of items.opReturns) {
    if (item.payload.type === TYPE_BURN) {
      const ok = await indexBurn(item, block, blockTimestamp, prisma);
      if (ok) result.burns++;
    } else if (item.payload.type === TYPE_SIGNAL) {
      await indexSignal(item, block, blockTimestamp, prisma);
      result.signals++;
    }
  }

  return result;
}

// ═══ POST INDEXING ═══

async function indexPost(
  item: DetectedEnvelope,
  block: BlockVerbose,
  timestamp: Date,
  prisma: PrismaClient,
): Promise<void> {
  const env = item.envelope as PostEnvelope;
  const contentHashHex = toHex(item.contentHash);
  const authorPubkey = toHex(env.pubkey);
  const topicHashHex =
    env.topic ? normalizedTopicHash(env.topic) : null;

  await prisma.post.upsert({
    where: { contentHash: contentHashHex },
    create: {
      contentHash: contentHashHex,
      txid: item.txid,
      blockHash: block.hash,
      blockHeight: block.height,
      authorPubkey,
      nonce: Buffer.from(env.nonce),
      signature: Buffer.from(env.sig),
      type: TYPE_POST,
      topic: env.topic || null,
      topicHash: topicHashHex,
      content: env.content,
      createdAt: timestamp,
    },
    update: {},
  });

  if (topicHashHex) {
    const normalName = normalizeTopic(env.topic);
    await prisma.topicAggregate.upsert({
      where: { topicHash: topicHashHex },
      create: {
        topicHash: topicHashHex,
        topicName: normalName,
        postCount: 1,
        lastActivityHeight: block.height,
      },
      update: {
        postCount: { increment: 1 },
        lastActivityHeight: block.height,
      },
    });
  }

  await upsertAuthorPost(authorPubkey, block.height, prisma);
}

// ═══ REPLY INDEXING ═══

async function indexReply(
  item: DetectedEnvelope,
  block: BlockVerbose,
  timestamp: Date,
  prisma: PrismaClient,
): Promise<void> {
  const env = item.envelope as ReplyEnvelope;
  const contentHashHex = toHex(item.contentHash);
  const authorPubkey = toHex(env.pubkey);
  const parentHashHex = toHex(env.parentHash);

  // Check FK: parentHash must reference an existing Post
  const parentExists = await prisma.post.findUnique({
    where: { contentHash: parentHashHex },
    select: { contentHash: true },
  });

  await prisma.post.upsert({
    where: { contentHash: contentHashHex },
    create: {
      contentHash: contentHashHex,
      txid: item.txid,
      blockHash: block.hash,
      blockHeight: block.height,
      authorPubkey,
      nonce: Buffer.from(env.nonce),
      signature: Buffer.from(env.sig),
      type: TYPE_REPLY,
      parentHash: parentExists ? parentHashHex : null,
      content: env.content,
      createdAt: timestamp,
    },
    update: {},
  });

  if (!parentExists) {
    console.warn(
      `  orphaned reply ${contentHashHex.slice(0, 12)}… — parent ${parentHashHex.slice(0, 12)}… not found`,
    );
  }

  await upsertAuthorPost(authorPubkey, block.height, prisma);
}

// ═══ BURN INDEXING ═══

async function indexBurn(
  item: DetectedOpReturn,
  block: BlockVerbose,
  timestamp: Date,
  prisma: PrismaClient,
): Promise<boolean> {
  const burn = item.payload as BurnPayload;
  const targetHashHex = toHex(burn.targetHash);

  // Deduplicate (crash recovery)
  const existing = await prisma.burn.findFirst({
    where: { txid: item.txid, blockHash: block.hash },
  });
  if (existing) return false;

  // Classify target type
  const targetPost = await prisma.post.findUnique({
    where: { contentHash: targetHashHex },
    select: { contentHash: true, authorPubkey: true },
  });
  const targetTopic = !targetPost
    ? await prisma.topicAggregate.findUnique({
        where: { topicHash: targetHashHex },
        select: { topicHash: true },
      })
    : null;
  const targetType: "content" | "topic" = targetPost
    ? "content"
    : targetTopic
      ? "topic"
      : "content";

  try {
    await prisma.burn.create({
      data: {
        txid: item.txid,
        blockHash: block.hash,
        blockHeight: block.height,
        targetHash: targetHashHex,
        targetType,
        amount: item.fee,
        createdAt: timestamp,
      },
    });
  } catch (e) {
    console.warn(
      `  burn skip tx ${item.txid.slice(0, 12)}…: ${(e as Error).message}`,
    );
    return false;
  }

  // Update aggregates
  if (targetType === "content" && targetPost) {
    await prisma.authorAggregate.upsert({
      where: { pubkey: targetPost.authorPubkey },
      create: {
        pubkey: targetPost.authorPubkey,
        totalBurnsReceived: item.fee,
        firstSeenHeight: block.height,
        lastSeenHeight: block.height,
      },
      update: {
        totalBurnsReceived: { increment: item.fee },
        lastSeenHeight: block.height,
      },
    });
  } else if (targetType === "topic") {
    await prisma.topicAggregate.update({
      where: { topicHash: targetHashHex },
      data: {
        totalBurned: { increment: item.fee },
        lastActivityHeight: block.height,
      },
    });
  }

  return true;
}

// ═══ SIGNAL INDEXING ═══

async function indexSignal(
  item: DetectedOpReturn,
  block: BlockVerbose,
  timestamp: Date,
  prisma: PrismaClient,
): Promise<void> {
  const signal = item.payload as SignalPayload;

  // Deduplicate (crash recovery)
  const existing = await prisma.signal.findFirst({
    where: { txid: item.txid, blockHash: block.hash },
  });
  if (existing) return;

  const signerPubkey = item.signerPubkey ?? "unknown";

  const refsJson = signal.refs.map((ref) =>
    ref.kind === "text"
      ? { kind: "text" as const, value: ref.value }
      : { kind: "content" as const, hashPrefix: toHex(ref.hashPrefix) },
  );

  await prisma.signal.create({
    data: {
      txid: item.txid,
      blockHash: block.hash,
      blockHeight: block.height,
      signerPubkey,
      fee: item.fee,
      refs: refsJson,
      createdAt: timestamp,
    },
  });

  if (item.signerPubkey) {
    await prisma.authorAggregate.upsert({
      where: { pubkey: item.signerPubkey },
      create: {
        pubkey: item.signerPubkey,
        firstSeenHeight: block.height,
        lastSeenHeight: block.height,
      },
      update: {
        lastSeenHeight: block.height,
      },
    });
  }
}

// ═══ AGGREGATE HELPERS ═══

async function upsertAuthorPost(
  pubkey: string,
  height: number,
  prisma: PrismaClient,
): Promise<void> {
  await prisma.authorAggregate.upsert({
    where: { pubkey },
    create: {
      pubkey,
      postCount: 1,
      firstSeenHeight: height,
      lastSeenHeight: height,
    },
    update: {
      postCount: { increment: 1 },
      lastSeenHeight: height,
    },
  });
}
