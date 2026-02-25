#!/bin/bash
# run_scan.sh - Daily scan runner (designed for cron)
# Usage: ./run_scan.sh
# Cron example (daily at 9am):
#   0 9 * * * /root/finance-my-film/run_scan.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure opencode is on PATH
export PATH="$HOME/.opencode/bin:$PATH"

echo "[$(date)] Starting daily film finance scan..."
python3 film_finance_finder.py
echo "[$(date)] Scan complete."
