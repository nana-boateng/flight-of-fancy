#!/bin/bash
# notify.sh - Send a message to ntfy and/or log to file
# Usage: ./notify.sh "Title" "Message" [priority]
# Priority: min, low, default, high, urgent

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load .env if present
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

TITLE="${1:-Film Finance Update}"
MESSAGE="${2:-No message provided}"
PRIORITY="${3:-default}"
OUTPUT_FILE="${OUTPUT_FILE:-funding_opportunities.log}"
NTFY_URL="${NTFY_URL:-}"
NTFY_TOPIC="${NTFY_TOPIC:-}"

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SEPARATOR="=================================================="

# Always log to file
{
    echo ""
    echo "$SEPARATOR"
    echo "$TIMESTAMP"
    echo "$TITLE"
    echo "$MESSAGE"
    echo "$SEPARATOR"
    echo ""
} >> "$SCRIPT_DIR/$OUTPUT_FILE"

echo "$TITLE"
echo "$MESSAGE"
echo "---"
echo "Logged to $OUTPUT_FILE"

# Send to ntfy if configured
if [ -n "$NTFY_URL" ] && [ -n "$NTFY_TOPIC" ]; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
        -H "Title: $TITLE" \
        -H "Priority: $PRIORITY" \
        -H "Tags: movie_camera" \
        -d "$MESSAGE" \
        "${NTFY_URL%/}/$NTFY_TOPIC" 2>/dev/null || echo "000")

    if [ "$HTTP_CODE" = "200" ]; then
        echo "Sent to ntfy"
    else
        echo "ntfy failed (HTTP $HTTP_CODE)"
    fi
else
    echo "ntfy not configured (set NTFY_URL and NTFY_TOPIC in .env)"
fi
