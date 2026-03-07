"use client";

import { Fragment } from "react";

const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/g;

type Segment =
  | { type: "text"; value: string }
  | { type: "link"; label: string; href: string; internal: boolean };

function parseContent(raw: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;

  for (const m of raw.matchAll(LINK_RE)) {
    const before = raw.slice(lastIndex, m.index);
    if (before) segments.push({ type: "text", value: before });

    const label = m[1];
    const href = m[2];
    const internal = href.startsWith("ocdn:");

    segments.push({ type: "link", label, href, internal });
    lastIndex = m.index! + m[0].length;
  }

  const tail = raw.slice(lastIndex);
  if (tail) segments.push({ type: "text", value: tail });
  return segments;
}

export function PostContent({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const segments = parseContent(content);
  const hasLinks = segments.some((s) => s.type === "link");

  if (!hasLinks) {
    return <span className={className}>{content}</span>;
  }

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        if (seg.type === "text") {
          return <Fragment key={i}>{seg.value}</Fragment>;
        }
        if (seg.internal) {
          return (
            <span
              key={i}
              className="text-blue-400/70 cursor-pointer hover:text-blue-400 transition-colors"
              title={seg.label || "referenced post"}
            >
              {seg.label || ">>ref"}
            </span>
          );
        }
        // External link (4chan etc)
        return (
          <a
            key={i}
            href={seg.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/30 hover:text-white/50 transition-colors"
            title={`View on 4chan`}
            onClick={(e) => e.stopPropagation()}
          >
            {seg.label || seg.href}
          </a>
        );
      })}
    </span>
  );
}
