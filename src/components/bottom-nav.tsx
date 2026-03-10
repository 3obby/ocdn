"use client";

import { LayoutList, Zap, Globe, User } from "lucide-react";

export type FeedTab = "topics" | "leaderboard" | "wall" | "profile";

export function BottomNav({
  tab,
  onTabChange,
  hideProfile = false,
}: {
  tab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  hideProfile?: boolean;
}) {
  const tabs: { key: FeedTab; icon: React.ReactNode; label: string }[] = [
    { key: "topics", icon: <LayoutList size={22} strokeWidth={1.5} />, label: "Topics" },
    { key: "leaderboard", icon: <Zap size={22} strokeWidth={1.5} />, label: "Board" },
    { key: "wall", icon: <Globe size={22} strokeWidth={1.5} />, label: "Wall" },
    { key: "profile", icon: <User size={22} strokeWidth={1.5} />, label: "Me" },
  ];
  const visibleTabs = hideProfile ? tabs.filter((t) => t.key !== "profile") : tabs;
  return (
    <nav className="flex shrink-0 items-center border-t border-border bg-elevated pb-[env(safe-area-inset-bottom)]">
      {visibleTabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onTabChange(t.key)}
          className={`flex min-h-[44px] flex-1 flex-col items-center justify-center py-2 transition-colors active:scale-95 ${
            tab === t.key ? "text-white" : "text-white/30 hover:text-white/50"
          }`}
          aria-label={t.label}
        >
          {t.icon}
        </button>
      ))}
    </nav>
  );
}
