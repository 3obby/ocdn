#!/usr/bin/env bash
#
# Scrape multiple 4chan board catalogs, then drip-feed each to the OCDN
# ingest API. Boards are processed sequentially with delays between scrapes
# (respects 4chan API rate limits) and each seed phase is drip-fed over a
# share of the cycle window.
#
# Boards: biz, g, pol, lit, fit, adv
#
# Designed to run every 2 hours via cron. Re-scans pick up new threads
# and update upvoteWeight on existing ones based on reply activity.
# Most posts are duplicates on re-scan so processing is fast.
#
# crontab entry:
#   0 */2 * * * /home/ocdn/ocdn/scripts/biz-scrape-and-seed.sh >> /home/ocdn/ocdn/logs/seed.log 2>&1
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/.venv-seed"
LOG_PREFIX="[seed-pipeline]"

BOARDS=(biz g pol lit fit adv)
SCRAPE_DELAY=3        # seconds between board scrapes (4chan asks ≤1 req/sec)
DRIP_HOURS_PER=0      # no drip on re-scan (most posts are dupes, fast)

log() { echo "$LOG_PREFIX $(date '+%Y-%m-%d %H:%M:%S')  $*"; }

# Load env vars
if [ -f "$PROJECT_DIR/.env.seed" ]; then
  set -a; source "$PROJECT_DIR/.env.seed"; set +a
fi

# Activate venv
if [ ! -d "$VENV_DIR" ]; then
  log "Creating Python venv at $VENV_DIR"
  python3 -m venv "$VENV_DIR"
  "$VENV_DIR/bin/pip" install -q requests
fi
source "$VENV_DIR/bin/activate"

# ── Phase 1: Scrape all boards ──────────────────────────────────────────────
log "Phase 1: Scraping ${#BOARDS[@]} boards: ${BOARDS[*]}"
for board in "${BOARDS[@]}"; do
  data_dir="$PROJECT_DIR/data/4chan_${board}"
  log "  Scraping /${board}/"
  python3 "$SCRIPT_DIR/scrape_4chan_biz.py" --board "$board" --out-dir "$data_dir"
  sleep "$SCRAPE_DELAY"
done

# ── Phase 2: Seed each board sequentially ────────────────────────────────────
log "Phase 2: Seeding ${#BOARDS[@]} boards to ${OCDN_API_URL:-https://ocdn.vercel.app} (${DRIP_HOURS_PER}h each)"
for board in "${BOARDS[@]}"; do
  log "  Seeding /${board}/ (drip over ${DRIP_HOURS_PER}h)"
  python3 "$SCRIPT_DIR/seed_4chan_biz.py" --board "$board" --drip-hours "$DRIP_HOURS_PER"
done

log "Pipeline complete (${#BOARDS[@]} boards)"
