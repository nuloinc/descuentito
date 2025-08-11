#!/bin/bash
set -e

echo "Starting Descuentito Scraper Container"
echo "Timezone: $(date)"

# Check if RUN_MODE is set to "once"
if [ "$RUN_MODE" = "once" ]; then
    echo "Running scraper once and exiting..."
    /usr/local/bin/run-scraper.sh
    exit 0
fi

# Default: run with supercronic scheduling
echo "Next scheduled runs:"
echo "- Mondays at 9:00 AM"
echo "- Fridays at 9:00 AM"

# Start supercronic with the crontab file
exec supercronic -overlapping /app/crontab