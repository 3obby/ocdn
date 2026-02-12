"use client";

import Link from "next/link";
import { RefResolver } from "@/components/resolve/RefResolver";
import { useHeaderStats } from "@/hooks/useSSE";
import { useIdentity } from "@/hooks/useIdentity";

export function Header() {
  const stats = useHeaderStats();
  const { identity, login } = useIdentity();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-accent">
            OCDN
          </span>
          <span className="hidden text-sm text-muted sm:inline">
            Content That Can&apos;t Be Killed
          </span>
        </Link>

        {/* Ref resolver (compact) */}
        <div className="hidden w-80 md:block">
          <RefResolver compact />
        </div>

        {/* Stats + identity */}
        <div className="flex items-center gap-4 text-xs text-muted font-mono">
          <StatPill label="docs" value={stats.docs} />
          <StatPill label="sats" value={stats.sats} />
          <StatPill label="hosts" value={stats.hosts} />

          {/* Identity indicator */}
          {identity.pubkey ? (
            <span
              className="rounded-full bg-accent/20 px-2 py-0.5 text-accent"
              title={identity.pubkey}
            >
              {identity.mode === "nip07" ? "NIP-07" : "ephemeral"}:{" "}
              {identity.pubkey.slice(0, 8)}
            </span>
          ) : (
            <button
              onClick={login}
              className="rounded-full bg-surface-2 px-2 py-0.5 text-muted hover:text-foreground transition-colors"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-foreground">{value}</span>
      <span>{label}</span>
    </div>
  );
}
