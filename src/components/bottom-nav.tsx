"use client";

import { Zap, User, ArrowLeft } from "lucide-react";

export type FeedTab = "topics" | "leaderboard" | "profile";

function TopicsListIcon({ size = 22 }: { size?: number }) {
  return (
    <span
      className="font-mono font-semibold leading-none text-current"
      style={{ fontSize: size * 0.7 }}
      aria-hidden
    >
      {"/\u002A"}
    </span>
  );
}

export function BottomNav({
  tab,
  onTabChange,
  showBack,
  onBack,
}: {
  tab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
  showBack?: boolean;
  onBack?: () => void;
}) {
  const tabs: { key: FeedTab; icon: React.ReactNode; label: string }[] = [
    { key: "topics", icon: <TopicsListIcon size={22} />, label: "Topics" },
    { key: "leaderboard", icon: <Zap size={22} strokeWidth={1.5} />, label: "Leaderboard" },
    { key: "profile", icon: <User size={22} strokeWidth={1.5} />, label: "Profile" },
  ];
  return (
    <nav className="flex shrink-0 items-center border-t border-white/[0.08] bg-elevated/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]">
      {showBack && onBack && (
        <button
          onClick={onBack}
          className="flex min-h-[44px] flex-1 flex-col items-center justify-center py-2 transition-colors active:scale-95 text-[#FF6800]"
          aria-label="Back"
        >
          <ArrowLeft size={22} strokeWidth={1.5} />
        </button>
      )}
      {tabs.map((t) => {
        const isActive = tab === t.key;
        return (
          <button
            key={t.key}
            onClick={() => onTabChange(t.key)}
            className={`flex min-h-[44px] flex-1 flex-col items-center justify-center py-2 transition-colors active:scale-95 ${
              isActive ? "text-[#FF6800]" : "text-white/30 hover:text-white/50"
            }`}
            aria-label={t.label}
          >
            {t.icon}
          </button>
        );
      })}
    </nav>
  );
}
