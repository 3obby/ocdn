import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ ref: string }>;
}

export default async function VerifyPage({ params }: PageProps) {
  const { ref } = await params;

  const pool = await prisma.pool.findUnique({
    where: { hash: ref },
    select: { balance: true, funderCount: true, totalFunded: true, createdAt: true },
  });

  const settlements = await prisma.settlementLine.findMany({
    where: { contentHash: ref },
    include: { settlement: { select: { epoch: true, eventId: true } } },
    orderBy: { settlement: { epoch: "desc" } },
    take: 20,
  });

  const receiptCount = await prisma.receipt.count({
    where: { contentHash: ref },
  });

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">Integrity Verification</h1>
      <p className="font-mono text-sm text-muted break-all mb-8">{ref}</p>

      {/* Pool summary */}
      <section className="rounded-lg border border-border bg-surface p-4 mb-6">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
          Pool State
        </h2>
        {pool ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Balance" value={`${pool.balance} sats`} />
            <Stat label="Total funded" value={`${pool.totalFunded} sats`} />
            <Stat label="Funders" value={String(pool.funderCount)} />
            <Stat label="Since" value={pool.createdAt.toISOString().slice(0, 10)} />
          </div>
        ) : (
          <p className="text-sm text-muted">No pool exists for this hash.</p>
        )}
      </section>

      {/* Receipt summary */}
      <section className="rounded-lg border border-border bg-surface p-4 mb-6">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
          Receipts
        </h2>
        <p className="text-sm">
          <span className="font-mono font-medium">{receiptCount}</span> verified
          receipts (proof of service events)
        </p>
      </section>

      {/* Settlement history */}
      <section className="rounded-lg border border-border bg-surface p-4 mb-6">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
          Settlement History
        </h2>
        {settlements.length === 0 ? (
          <p className="text-sm text-muted">No settlements yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="pb-2">Epoch</th>
                <th className="pb-2">Host</th>
                <th className="pb-2 text-right">Reward</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="py-1.5 font-mono">{s.settlement.epoch}</td>
                  <td className="py-1.5 font-mono text-xs">
                    {s.hostPubkey.slice(0, 12)}...
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {s.rewardSats.toString()} sats
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Bitcoin anchor (placeholder) */}
      <section className="rounded-lg border border-border bg-surface p-4">
        <h2 className="text-sm font-medium text-muted uppercase tracking-wider mb-3">
          Bitcoin Anchor
        </h2>
        <p className="text-sm text-muted">
          Daily Taproot tweak with epoch root + snapshot hash. Anchor
          verification coming soon.
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-sm font-medium">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
