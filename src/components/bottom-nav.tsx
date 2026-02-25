"use client";

import { Home, Search } from "lucide-react";

export function BottomNav({
  tab,
  onTabChange,
}: {
  tab: "feed" | "search";
  onTabChange: (tab: "feed" | "search") => void;
}) {
  return (
    <nav className="flex h-14 shrink-0 items-center border-t border-border">
      <button
        onClick={() => onTabChange("feed")}
        className={`flex flex-1 items-center justify-center transition-colors ${
          tab === "feed" ? "text-white" : "text-white/20 hover:text-white/50"
        }`}
      >
        <Home size={24} strokeWidth={1.5} />
      </button>
      <div className="h-6 w-px bg-border" />
      <button
        onClick={() => onTabChange("search")}
        className={`flex flex-1 items-center justify-center transition-colors ${
          tab === "search" ? "text-white" : "text-white/20 hover:text-white/50"
        }`}
      >
        <Search size={24} strokeWidth={1.5} />
      </button>
    </nav>
  );
}
