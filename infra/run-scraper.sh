#!/bin/bash
set -e

echo "$(date): Starting scraper execution" >> /var/log/scraper/scheduler.log

# Set display for headful browser
export DISPLAY=:99
export HEADLESS=false
export LOCAL_BROWSER=true

# Start virtual display for headful browser
Xvfb :99 -screen 0 1920x1080x16 -nolisten tcp -dpi 96 +extension GLX +render -noreset &
XVFB_PID=$!

# Wait for display to be ready
sleep 3

cd /app/scraper

# Run all scrapers with save flag
echo "$(date): Running scrapers..." >> /var/log/scraper/scheduler.log
bun run cli all --save --telegram 2>&1 | tee -a /var/log/scraper/scheduler.log

# Clean up
kill $XVFB_PID 2>/dev/null || true

echo "$(date): Scraper execution completed" >> /var/log/scraper/scheduler.log