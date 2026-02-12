"use client";

import Link from "next/link";
import { RefResolver } from "@/components/resolve/RefResolver";

export function Header() {
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

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-xs text-muted font-mono">
          <StatPill label="docs" value="—" />
          <StatPill label="sats" value="—" />
          <StatPill label="hosts" value="—" />
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
