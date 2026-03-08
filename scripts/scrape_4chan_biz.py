#!/usr/bin/env python3
"""
Scrape a 4chan board catalog via the official JSON API and save to a dated file.

Design:
- Uses 4chan's read-only API (a.4cdn.org), not HTML scraping. One GET to
  catalog.json returns all thread metadata for the board; this is the most
  firewall-friendly approach and avoids the main site's anti-bot layers.
- One request per run per board; no rate-limit issues.
- Output: one JSON file per run (e.g. data/4chan_biz/biz_catalog_2025-03-07.json)
  so you keep a history for mutating/seeding content.

Usage:
  python scripts/scrape_4chan_biz.py [--board biz] [--out-dir DIR]
"""

import argparse
import json
import sys
import time
from pathlib import Path

try:
    import requests
except ImportError:
    print("Install dependencies: pip install -r scripts/requirements.txt", file=sys.stderr)
    sys.exit(1)

USER_AGENT = "ocdn-scraper/1.0 (+https://github.com/4chan/4chan-API)"
TIMEOUT = 30
RETRIES = 3
RETRY_DELAY = 5


def fetch_catalog(session: requests.Session, board: str) -> list:
    url = f"https://a.4cdn.org/{board}/catalog.json"
    for attempt in range(RETRIES):
        try:
            r = session.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            if attempt < RETRIES - 1:
                time.sleep(RETRY_DELAY)
                continue
            raise SystemExit(f"Failed after {RETRIES} attempts: {e}") from e
    assert False, "unreachable"


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape a 4chan board catalog to a JSON file.")
    parser.add_argument("--board", default="biz", help="Board name (default: biz)")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Directory to write dated JSON files (default: data/4chan_{board})",
    )
    args = parser.parse_args()

    board = args.board
    out_dir = args.out_dir or (Path(__file__).resolve().parent.parent / "data" / f"4chan_{board}")
    out_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    catalog = fetch_catalog(session, board)
    date_str = time.strftime("%Y-%m-%d")
    out_path = out_dir / f"{board}_catalog_{date_str}.json"

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=0)

    total_threads = sum(len(p.get("threads", [])) for p in catalog)
    print(f"[{board}] Wrote {total_threads} threads to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
