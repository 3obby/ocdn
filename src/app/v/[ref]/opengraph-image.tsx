import { ImageResponse } from "next/og";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const alt = "OCDN Content";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

interface Props {
  params: Promise<{ ref: string }>;
}

export default async function OGImage({ params }: Props) {
  const { ref } = await params;

  const pool = await prisma.pool.findUnique({
    where: { hash: ref },
    select: { balance: true, funderCount: true },
  });

  const importance = await prisma.importance.findUnique({
    where: { hash: ref },
    select: { score: true, commitment: true, demand: true, centrality: true, label: true },
  });

  const balance = pool ? formatSats(pool.balance.toString()) : "0";
  const funders = pool?.funderCount ?? 0;
  const label = importance?.label ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          color: "#ededed",
          fontFamily: "monospace",
          padding: "60px",
        }}
      >
        {/* Top: logo + label */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "48px", fontWeight: 700, color: "#f7931a" }}>
              OCDN
            </span>
            <span style={{ fontSize: "20px", color: "#888" }}>
              Content That Can&apos;t Be Killed
            </span>
          </div>
          {label && (
            <span
              style={{
                fontSize: "20px",
                padding: "8px 20px",
                borderRadius: "999px",
                backgroundColor:
                  label === "underpriced"
                    ? "rgba(34,197,94,0.2)"
                    : label === "flash"
                      ? "rgba(234,179,8,0.2)"
                      : "rgba(247,147,26,0.2)",
                color:
                  label === "underpriced"
                    ? "#22c55e"
                    : label === "flash"
                      ? "#eab308"
                      : "#f7931a",
              }}
            >
              {label}
            </span>
          )}
        </div>

        {/* Middle: hash + stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <span style={{ fontSize: "24px", color: "#888", wordBreak: "break-all" }}>
            {ref}
          </span>
          <div style={{ display: "flex", gap: "48px" }}>
            <Stat label="Pool Balance" value={`${balance} sats`} />
            <Stat label="Funders" value={String(funders)} />
            {importance && (
              <>
                <Stat label="Commitment" value={`${(importance.commitment * 100).toFixed(0)}%`} />
                <Stat label="Demand" value={`${(importance.demand * 100).toFixed(0)}%`} />
                <Stat label="Centrality" value={`${(importance.centrality * 100).toFixed(0)}%`} />
              </>
            )}
          </div>
        </div>

        {/* Bottom: CTA */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "24px", color: "#f7931a", fontWeight: 600 }}>
            {funders} {funders === 1 ? "person" : "people"} funded this
            document&apos;s survival
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span style={{ fontSize: "36px", fontWeight: 600 }}>{value}</span>
      <span style={{ fontSize: "16px", color: "#888" }}>{label}</span>
    </div>
  );
}

function formatSats(sats: string): string {
  const n = Number(sats);
  if (n >= 100_000_000) return `${(n / 100_000_000).toFixed(2)} BTC`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return sats;
}
