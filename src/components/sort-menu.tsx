"use client";

import type { SortMode } from "@/lib/mock-data";
import { type TextSize, useTextSize, ts } from "@/lib/text-size";

const MODES: { key: SortMode; label: string }[] = [
  { key: "topics", label: "topics" },
  { key: "new", label: "new" },
  { key: "top", label: "top" },
];

export function SortMenu({
  active,
  onChange,
  textSize,
  onTextSizeChange,
}: {
  active: SortMode;
  onChange: (mode: SortMode) => void;
  textSize: TextSize;
  onTextSizeChange: (size: TextSize) => void;
}) {
  const sz = useTextSize();

  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border">
      <div className="flex items-center gap-4">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => onChange(m.key)}
            className={`${ts(sz)} leading-tight transition-colors ${
              active === m.key
                ? "text-white"
                : "text-white/20 hover:text-white/50"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => onTextSizeChange(textSize === "sm" ? "lg" : "sm")}
        className="flex items-baseline gap-0 text-white/40 hover:text-white/70 transition-colors"
      >
        <span className={`${textSize === "sm" ? "text-white" : ""} text-[11px] leading-none`}>a</span>
        <span className={`${textSize === "lg" ? "text-white" : ""} text-[18px] leading-none`}>A</span>
      </button>
    </div>
  );
}
