#!/usr/bin/env bash
#
# Scrape 4chan /biz/ catalog, then drip-feed threads to the OCDN ingest API
# over 4 hours. Designed to run every 8 hours via cron.
#
# crontab entry:
#   0 */8 * * * /home/ocdn/ocdn/scripts/biz-scrape-and-seed.sh >> /home/ocdn/ocdn/logs/biz-seed.log 2>&1
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$PROJECT_DIR/.venv-seed"
DATA_DIR="$PROJECT_DIR/data/4chan_biz"
LOG_PREFIX="[biz-pipeline]"

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

# ── Phase 1: Scrape ─────────────────────────────────────────────────────────
log "Phase 1: Scraping /biz/ catalog"
python3 "$SCRIPT_DIR/scrape_4chan_biz.py" --out-dir "$DATA_DIR"

# ── Phase 2: Seed (drip over 4 hours) ───────────────────────────────────────
log "Phase 2: Seeding to $OCDN_API_URL (drip over 4h)"
python3 "$SCRIPT_DIR/seed_4chan_biz.py" --drip-hours 4

log "Pipeline complete"
