#!/usr/bin/env python3
"""
Scrape 4chan /biz/ board via the official JSON API and save to a dated file.

Design:
- Uses 4chan's read-only API (a.4cdn.org), not HTML scraping. One GET to
  catalog.json returns all thread metadata for the board; this is the most
  firewall-friendly approach and avoids the main site's anti-bot layers.
- One request per run is suitable for daily cron; no rate-limit issues.
- Output: one JSON file per run (e.g. data/4chan_biz/biz_catalog_2025-03-07.json)
  so you keep a history for mutating/seeding content.

Usage:
  python scripts/scrape_4chan_biz.py [--out-dir DIR]
  # or with venv: pip install -r scripts/requirements.txt && python scripts/scrape_4chan_biz.py
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

BOARD = "biz"
CATALOG_URL = f"https://a.4cdn.org/{BOARD}/catalog.json"
USER_AGENT = "ocdn-biz-scraper/1.0 (+https://github.com/4chan/4chan-API)"
TIMEOUT = 30
RETRIES = 3
RETRY_DELAY = 5


def fetch_catalog(session: requests.Session) -> list:
    for attempt in range(RETRIES):
        try:
            r = session.get(CATALOG_URL, timeout=TIMEOUT)
            r.raise_for_status()
            return r.json()
        except requests.RequestException as e:
            if attempt < RETRIES - 1:
                time.sleep(RETRY_DELAY)
                continue
            raise SystemExit(f"Failed after {RETRIES} attempts: {e}") from e
    assert False, "unreachable"


def main() -> None:
    parser = argparse.ArgumentParser(description="Scrape 4chan /biz/ catalog to a JSON file.")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "data" / "4chan_biz",
        help="Directory to write dated JSON files (default: data/4chan_biz)",
    )
    args = parser.parse_args()

    out_dir = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    catalog = fetch_catalog(session)
    # catalog is list of pages; each page has "threads" and "page"
    date_str = time.strftime("%Y-%m-%d")
    out_path = out_dir / f"biz_catalog_{date_str}.json"

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, ensure_ascii=False, indent=0)

    total_threads = sum(len(p.get("threads", [])) for p in catalog)
    print(f"Wrote {total_threads} threads to {out_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
