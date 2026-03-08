#!/usr/bin/env python3
"""
Transform a scraped 4chan board catalog JSON and ingest it into OCDN as
ephemeral posts via the /api/seed/ingest endpoint.

Features:
- All threads are filed under the board name as topic (e.g. "biz", "g", "pol")
- Parses >>N quotelinks from HTML to build proper reply trees
- Rewrites >>N refs in body:
    parent ref  → stripped (tree structure shows parentage)
    known ref   → [>>N](ocdn:4chan:BOARD:N)  (frontend renders as internal link)
    unknown ref → [<+N>](https://boards.4chan.org/BOARD/thread/THREAD#pN)
- Supports drip-feed mode (--drip-hours)

Usage:
  python scripts/seed_4chan_biz.py [--board biz] [--api-url URL] [--api-key KEY] [--drip-hours N]

Env vars (override CLI flags):
  OCDN_API_URL   e.g. https://ocdn.vercel.app
  API_WRITE_KEY  the same key the server expects
"""

import argparse
import html as html_mod
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

LOG_PREFIX = "[seed]"

QUOTELINK_RE = re.compile(r'<a\s+href="[^"]*#p(\d+)"[^>]*class="quotelink"[^>]*>[^<]*</a>', re.I)
BARE_REF_RE = re.compile(r'>>(\d+)')


def log(msg: str) -> None:
    ts = time.strftime("%Y-%m-%d %H:%M:%S")
    print(f"{LOG_PREFIX} {ts}  {msg}", file=sys.stderr, flush=True)


# ── Reference extraction ─────────────────────────────────────────────────────

def extract_refs(raw_html: str | None) -> list[int]:
    """Extract all >>N post numbers from raw 4chan HTML, preserving order."""
    if not raw_html:
        return []
    refs = []
    seen = set()
    for m in QUOTELINK_RE.finditer(raw_html):
        n = int(m.group(1))
        if n not in seen:
            refs.append(n)
            seen.add(n)
    return refs


# ── HTML → text with reference rewriting ─────────────────────────────────────

def html_to_text_with_refs(
    raw_html: str | None,
    thread_no: int,
    parent_no: int | None,
    known_nos: set[int],
    board: str,
) -> str:
    """Convert 4chan HTML to plain text, rewriting >>N references."""
    if not raw_html:
        return ""

    text = raw_html

    def replace_quotelink(m: re.Match) -> str:
        n = int(m.group(1))
        if n == parent_no:
            return ""
        if n in known_nos:
            return f"\x00OCDN_REF[>>{n}](ocdn:4chan:{board}:{n})\x00"
        return f"\x00OCDN_REF[+{n}](https://boards.4chan.org/{board}/thread/{thread_no}#p{n})\x00"

    text = QUOTELINK_RE.sub(replace_quotelink, text)

    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<wbr\s*/?>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html_mod.unescape(text)

    def replace_bare_ref(m: re.Match) -> str:
        n = int(m.group(1))
        if n == parent_no:
            return ""
        if n in known_nos:
            return f"[>>{n}](ocdn:4chan:{board}:{n})"
        return f"[+{n}](https://boards.4chan.org/{board}/thread/{thread_no}#p{n})"

    text = BARE_REF_RE.sub(replace_bare_ref, text)

    text = text.replace("\x00OCDN_REF", "").replace("\x00", "")

    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def html_to_text_simple(raw: str | None) -> str:
    """Simple HTML strip for OP bodies (no ref rewriting needed for OP)."""
    if not raw:
        return ""
    text = raw
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<wbr\s*/?>", "", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html_mod.unescape(text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


# ── Catalog → ingest items ───────────────────────────────────────────────────

def catalog_to_items(catalog: list, board: str, topic: str) -> list[dict]:
    items = []
    for page in catalog:
        for thread in page.get("threads", []):
            if thread.get("sticky") or thread.get("closed"):
                continue

            thread_no = thread.get("no", 0)
            body = html_to_text_simple(thread.get("com"))
            if not body:
                continue

            total_replies = thread.get("replies", 0)
            raw_replies = thread.get("last_replies", [])

            known_nos: set[int] = {thread_no}
            for r in raw_replies:
                known_nos.add(r.get("no", 0))

            reply_data: list[dict] = []
            for r in raw_replies:
                r_no = r.get("no", 0)
                r_html = r.get("com")
                refs = extract_refs(r_html)

                parent_ref_no = None
                for ref_no in refs:
                    if ref_no in known_nos and ref_no != r_no:
                        parent_ref_no = ref_no
                        break
                if parent_ref_no is None:
                    parent_ref_no = thread_no

                content = html_to_text_with_refs(
                    r_html, thread_no, parent_ref_no, known_nos, board,
                )
                if not content:
                    continue

                reply_data.append({
                    "content": content,
                    "sourceId": f"4chan:{board}:{r_no}",
                    "sourceTs": r.get("time", 0),
                    "parentSourceId": f"4chan:{board}:{parent_ref_no}",
                })

            items.append({
                "topic": topic,
                "content": body,
                "sourceId": f"4chan:{board}:{thread_no}",
                "sourceTs": thread.get("time", 0),
                "replies": reply_data,
                "upvoteWeight": 1 + total_replies,
            })

    return items


# ── Post one thread to the ingest API ────────────────────────────────────────

def post_item(session: requests.Session, url: str, item: dict) -> dict:
    resp = session.post(url, json={"items": [item]}, timeout=60)
    if resp.status_code in (200, 201):
        return resp.json()
    else:
        log(f"  FAILED ({resp.status_code}): {resp.text[:200]}")
        return {"inserted": 0, "skipped": 0, "errors": 1}


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    import os

    parser = argparse.ArgumentParser(description="Seed OCDN with 4chan board catalog data.")
    parser.add_argument("--board", default="biz", help="Board name (default: biz)")
    parser.add_argument("--api-url", default=os.environ.get("OCDN_API_URL", "https://ocdn.vercel.app"))
    parser.add_argument("--api-key", default=os.environ.get("API_WRITE_KEY", ""))
    parser.add_argument("--catalog", type=Path, default=None, help="Path to a specific catalog JSON file")
    parser.add_argument("--drip-hours", type=float, default=0,
                        help="Spread posts evenly over N hours (0 = post all at once)")
    parser.add_argument("--dry-run", action="store_true", help="Print item count without POSTing")
    args = parser.parse_args()

    board = args.board
    topic = board
    data_dir = Path(__file__).resolve().parent.parent / "data" / f"4chan_{board}"

    if args.catalog:
        catalog_path = args.catalog
    else:
        files = sorted(data_dir.glob(f"{board}_catalog_*.json"))
        if not files:
            log(f"No catalog files found in {data_dir}")
            sys.exit(1)
        catalog_path = files[-1]

    log(f"[{board}] Reading {catalog_path}")
    with open(catalog_path, encoding="utf-8") as f:
        catalog = json.load(f)

    items = catalog_to_items(catalog, board, topic)
    total_replies = sum(len(it.get("replies", [])) for it in items)
    log(f"[{board}] Transformed {len(items)} threads ({total_replies} replies), topic={topic}")

    if args.dry_run:
        for it in items[:3]:
            print(json.dumps({
                "topic": it["topic"],
                "content": it["content"][:100] + "...",
                "replies": [
                    {"content": r["content"][:80] + "...", "parentSourceId": r.get("parentSourceId")}
                    for r in it.get("replies", [])[:3]
                ],
            }, indent=2, ensure_ascii=False))
        log(f"[{board}] {len(items)} total, dry-run — nothing posted")
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

    drip_seconds = args.drip_hours * 3600
    delay = drip_seconds / max(len(items), 1) if drip_seconds > 0 else 0

    total_inserted = 0
    total_skipped = 0
    total_errors = 0

    if delay > 0:
        log(f"[{board}] Drip mode: ~{delay:.1f}s between threads, total ~{args.drip_hours:.1f}h")

    for i, item in enumerate(items):
        result = post_item(session, url, item)
        total_inserted += result.get("inserted", 0)
        total_skipped += result.get("skipped", 0)
        total_errors += result.get("errors", 0)

        n_replies = len(item.get("replies", []))
        log(f"  [{board}] [{i+1}/{len(items)}] +{result.get('inserted',0)} new, "
            f"{result.get('skipped',0)} dup, {n_replies} replies")

        if delay > 0 and i < len(items) - 1:
            time.sleep(delay)

    log(f"[{board}] Done: inserted={total_inserted} skipped={total_skipped} errors={total_errors}")


if __name__ == "__main__":
    main()
