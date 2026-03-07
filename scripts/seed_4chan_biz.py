#!/usr/bin/env python3
"""
Transform a scraped 4chan /biz/ catalog JSON and ingest it into OCDN as
ephemeral posts via the /api/seed/ingest endpoint.

Reads the most recent catalog file from data/4chan_biz/, strips HTML,
extracts topics (thread subjects) and replies, then POSTs the batch.

Supports drip-feed mode: instead of posting everything at once, spreads
threads evenly over --drip-hours so content appears gradually.

Usage:
  python scripts/seed_4chan_biz.py [--api-url URL] [--api-key KEY] [--drip-hours N]

Env vars (override CLI flags):
  OCDN_API_URL   e.g. https://ocdn.vercel.app
  API_WRITE_KEY  the same key the server expects
"""

import argparse
import html
import json
import re
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("Install dependencies: pip install -r scripts/requirements.txt", file=sys.stderr)
    sys.exit(1)

DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "4chan_biz"
LOG_PREFIX = "[seed]"


def log(msg: str) -> None:
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"{LOG_PREFIX} {ts}  {msg}", file=sys.stderr, flush=True)


# ── HTML → plain text ───────────────────────────────────────────────────────

def html_to_text(raw: str | None) -> str:
    if not raw:
        return ""
    text = raw
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<wbr\s*/?>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Catalog → ingest items ──────────────────────────────────────────────────

def catalog_to_items(catalog: list) -> list[dict]:
    items = []
    for page in catalog:
        for thread in page.get("threads", []):
            if thread.get("sticky") or thread.get("closed"):
                continue

            thread_no = thread.get("no", 0)
            subject = html_to_text(thread.get("sub"))
            body = html_to_text(thread.get("com"))

            if not body:
                continue

            topic = subject if subject else None

            replies = []
            for reply in thread.get("last_replies", []):
                reply_body = html_to_text(reply.get("com"))
                if not reply_body:
                    continue
                replies.append({
                    "content": reply_body,
                    "sourceId": f"4chan:biz:{reply.get('no', 0)}",
                    "sourceTs": reply.get("time", 0),
                })

            items.append({
                "topic": topic,
                "content": body,
                "sourceId": f"4chan:biz:{thread_no}",
                "sourceTs": thread.get("time", 0),
                "replies": replies,
            })

    return items


# ── Post one thread (parent + replies) to the ingest API ────────────────────

def post_item(session: requests.Session, url: str, item: dict) -> dict:
    """POST a single thread+replies to the ingest endpoint. Returns stats."""
    resp = session.post(url, json={"items": [item]}, timeout=60)
    if resp.status_code in (200, 201):
        return resp.json()
    else:
        log(f"  FAILED ({resp.status_code}): {resp.text[:200]}")
        return {"inserted": 0, "skipped": 0, "errors": 1}


# ── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    import os

    parser = argparse.ArgumentParser(description="Seed OCDN with 4chan /biz/ catalog data.")
    parser.add_argument("--api-url", default=os.environ.get("OCDN_API_URL", "https://ocdn.vercel.app"))
    parser.add_argument("--api-key", default=os.environ.get("API_WRITE_KEY", ""))
    parser.add_argument("--catalog", type=Path, default=None, help="Path to a specific catalog JSON file")
    parser.add_argument("--drip-hours", type=float, default=0,
                        help="Spread posts evenly over N hours (0 = post all at once)")
    parser.add_argument("--dry-run", action="store_true", help="Print item count without POSTing")
    args = parser.parse_args()

    # Find catalog file
    if args.catalog:
        catalog_path = args.catalog
    else:
        files = sorted(DATA_DIR.glob("biz_catalog_*.json"))
        if not files:
            log(f"No catalog files found in {DATA_DIR}")
            sys.exit(1)
        catalog_path = files[-1]

    log(f"Reading {catalog_path}")
    with open(catalog_path, encoding="utf-8") as f:
        catalog = json.load(f)

    items = catalog_to_items(catalog)
    total_replies = sum(len(it.get("replies", [])) for it in items)
    log(f"Transformed {len(items)} threads ({total_replies} replies)")

    if args.dry_run:
        for it in items[:5]:
            print(json.dumps({
                "topic": it["topic"],
                "content": it["content"][:120] + ("..." if len(it["content"]) > 120 else ""),
                "replies": len(it.get("replies", [])),
            }, indent=2))
        log(f"{len(items)} total, dry-run — nothing posted")
        return

    if not args.api_key:
        log("API_WRITE_KEY not set. Use --api-key or set env var.")
        sys.exit(1)

    url = f"{args.api_url.rstrip('/')}/api/seed/ingest"
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "x-api-key": args.api_key,
    })

    # Compute delay between threads for drip-feed
    drip_seconds = args.drip_hours * 3600
    delay = drip_seconds / max(len(items), 1) if drip_seconds > 0 else 0

    total_inserted = 0
    total_skipped = 0
    total_errors = 0

    if delay > 0:
        log(f"Drip mode: ~{delay:.1f}s between threads, total ~{args.drip_hours:.1f}h")

    for i, item in enumerate(items):
        result = post_item(session, url, item)
        total_inserted += result.get("inserted", 0)
        total_skipped += result.get("skipped", 0)
        total_errors += result.get("errors", 0)

        n_replies = len(item.get("replies", []))
        topic_label = (item.get("topic") or "(no topic)")[:50]
        log(f"  [{i+1}/{len(items)}] {topic_label}  +{result.get('inserted',0)} new, "
            f"{result.get('skipped',0)} dup, {n_replies} replies")

        if delay > 0 and i < len(items) - 1:
            time.sleep(delay)

    log(f"Done: inserted={total_inserted} skipped={total_skipped} errors={total_errors}")


if __name__ == "__main__":
    main()
