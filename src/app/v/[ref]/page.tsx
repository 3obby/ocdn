import { prisma } from "@/lib/db";
import { epochRewardCap, sustainabilityRatio } from "@/lib/pool";
import { AUTO_BID_PCT } from "@/lib/constants";
import { BlobEmbed } from "@/components/content/BlobEmbed";
import { InstrumentCluster } from "@/components/content/InstrumentCluster";
import { Discussion } from "@/components/content/Discussion";
import { CitationList } from "@/components/content/CitationList";
import { FortifyButton } from "@/components/fortify/FortifyButton";
import { ShareButton } from "@/components/shared/ShareButton";
import { PushCTA } from "@/components/content/PushCTA";
import { EmbedGenerator } from "@/components/content/EmbedGenerator";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ ref: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ref } = await params;

  const pool = await prisma.pool.findUnique({
    where: { hash: ref },
    select: { balance: true, funderCount: true },
  });

  const title = pool
    ? `${pool.funderCount} funders · ${pool.balance} sats — OCDN`
    : `Content ${ref.slice(0, 8)}... — OCDN`;

  return {
    title,
    description: pool
      ? `${pool.funderCount} people funded this document's survival.`
      : "Content on the importance index.",
    openGraph: { title },
  };
}

export default async function ContentPage({ params }: PageProps) {
  const { ref } = await params;

  const pool = await prisma.pool.findUnique({
    where: { hash: ref },
    include: {
      _count: { select: { receipts: true } },
    },
  });

  const importance = await prisma.importance.findUnique({
    where: { hash: ref },
  });

  // Citations
  const citedBy = await prisma.citationEdge.findMany({
    where: { targetHash: ref },
    select: { sourceHash: true, edgeType: true },
    take: 50,
  });

  const cites = await prisma.citationEdge.findMany({
    where: { sourceHash: ref },
    select: { targetHash: true, edgeType: true },
    take: 50,
  });

  // Compute sustainability
  const recentReceipts = await prisma.receipt.aggregate({
    where: { contentHash: ref },
    _sum: { priceSats: true },
  });
  const autoBid = BigInt(
    Math.floor(Number(recentReceipts._sum.priceSats ?? 0n) * AUTO_BID_PCT)
  );
  const drain = pool ? epochRewardCap(pool.balance) : 0n;
  const sustainability = sustainabilityRatio(autoBid, drain);

  // Not indexed state — show Push CTA
  if (!pool && !importance) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="text-center space-y-6">
          <h1 className="text-2xl font-bold">Not Indexed</h1>
          <p className="font-mono text-sm text-muted break-all">{ref}</p>
          <p className="text-muted">
            This hash isn&apos;t in the index yet. Push content to bring it to life.
          </p>
          <PushCTA contentHash={ref} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Hash header + actions */}
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-mono text-sm text-muted break-all min-w-0">{ref}</h1>
        <div className="flex items-center gap-2 shrink-0">
          <ShareButton
            contentHash={ref}
            funderCount={pool?.funderCount}
            poolBalance={pool?.balance.toString()}
            size="md"
          />
          <FortifyButton contentHash={ref} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left: content embed */}
        <div className="lg:col-span-2 space-y-6">
          <BlobEmbed hash={ref} />
          <Discussion contentHash={ref} />
        </div>

        {/* Right: instrument cluster */}
        <div className="space-y-6">
          <InstrumentCluster
            poolBalance={pool?.balance.toString() ?? "0"}
            funderCount={pool?.funderCount ?? 0}
            receiptCount={pool?._count.receipts ?? 0}
            sustainabilityRatio={sustainability}
            commitment={importance?.commitment ?? 0}
            demand={importance?.demand ?? 0}
            centrality={importance?.centrality ?? 0}
            label={importance?.label ?? null}
            drainPerEpoch={drain.toString()}
          />
          <CitationList
            citedBy={citedBy.map((e) => ({ hash: e.sourceHash, edgeType: e.edgeType }))}
            cites={cites.map((e) => ({ hash: e.targetHash, edgeType: e.edgeType }))}
          />
          <EmbedGenerator contentHash={ref} />
        </div>
      </div>
    </div>
  );
}
