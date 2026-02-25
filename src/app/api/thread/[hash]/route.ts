import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { mapPost, getTipHeight, rateLimit, notFound, errorResponse, log } from "@/lib/api-utils";
import type { Post as PrismaPost } from "@/generated/prisma/client";
import type { ThreadItem } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

type PostWithBurns = PrismaPost & { burns: { amount: bigint }[] };

/**
 * GET /api/thread/:hash
 *
 * Returns the full thread: ancestors → focal post → descendants, each with a depth number.
 * Matches the buildThread() behavior from mock-data.ts.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const limited = rateLimit(request, "read");
  if (limited) return limited;

  const { hash } = await params;

  try {
    const tipHeight = await getTipHeight(prisma);

    const focalPost = await prisma.post.findUnique({
      where: { contentHash: hash },
      include: { burns: { select: { amount: true } } },
    });

    if (!focalPost) return notFound("Post not found");

    const ancestors = await walkAncestors(focalPost.parentHash);
    const descendants = await walkDescendants(hash);

    const items: ThreadItem[] = [];

    for (let i = 0; i < ancestors.length; i++) {
      items.push({ ...mapPost(ancestors[i], tipHeight), depth: i });
    }

    const selfDepth = ancestors.length;
    items.push({ ...mapPost(focalPost, tipHeight), depth: selfDepth });

    flattenDescendants(descendants, selfDepth + 1, items, tipHeight);

    return NextResponse.json({ thread: items });
  } catch (err) {
    log("error", "api/thread", "thread query failed", { hash, error: String(err) });
    return errorResponse("Internal server error", 500);
  }
}

async function walkAncestors(parentHash: string | null): Promise<PostWithBurns[]> {
  const ancestors: PostWithBurns[] = [];
  let currentHash = parentHash;

  while (currentHash) {
    const post = await prisma.post.findUnique({
      where: { contentHash: currentHash },
      include: { burns: { select: { amount: true } } },
    });
    if (!post) break;
    ancestors.unshift(post);
    currentHash = post.parentHash;
  }

  return ancestors;
}

async function walkDescendants(parentHash: string): Promise<Map<string, PostWithBurns[]>> {
  // Fetch all descendants in bulk and group by parentHash
  const allDescendants = await fetchAllDescendants(parentHash);
  const byParent = new Map<string, PostWithBurns[]>();

  for (const post of allDescendants) {
    const key = post.parentHash!;
    const arr = byParent.get(key) ?? [];
    arr.push(post);
    byParent.set(key, arr);
  }

  return byParent;
}

async function fetchAllDescendants(rootHash: string): Promise<PostWithBurns[]> {
  const result: PostWithBurns[] = [];
  const queue = [rootHash];

  while (queue.length > 0) {
    const batch = queue.splice(0, queue.length);
    const children = await prisma.post.findMany({
      where: { parentHash: { in: batch } },
      include: { burns: { select: { amount: true } } },
      orderBy: { createdAt: "asc" },
    });

    for (const child of children) {
      result.push(child);
      queue.push(child.contentHash);
    }
  }

  return result;
}

function flattenDescendants(
  byParent: Map<string, PostWithBurns[]>,
  depth: number,
  items: ThreadItem[],
  tipHeight: number,
) {
  const parentHash = items[items.length - 1]?.contentHash;
  if (!parentHash) return;

  const children = byParent.get(parentHash) ?? [];
  for (const child of children) {
    items.push({ ...mapPost(child, tipHeight), depth });
    // Recurse for this child's descendants
    const grandchildren = byParent.get(child.contentHash);
    if (grandchildren) {
      flattenDescendantsRecursive(byParent, child.contentHash, depth + 1, items, tipHeight);
    }
  }
}

function flattenDescendantsRecursive(
  byParent: Map<string, PostWithBurns[]>,
  parentHash: string,
  depth: number,
  items: ThreadItem[],
  tipHeight: number,
) {
  const children = byParent.get(parentHash) ?? [];
  for (const child of children) {
    items.push({ ...mapPost(child, tipHeight), depth });
    flattenDescendantsRecursive(byParent, child.contentHash, depth + 1, items, tipHeight);
  }
}
