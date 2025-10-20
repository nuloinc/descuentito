#!/bin/bash
set -e

echo "$(date): Starting scraper execution" >> /var/log/scraper/scheduler.log

# Set display for headful browser
export DISPLAY=:99
export HEADLESS=false
export LOCAL_BROWSER=true

# Clean up any stale X server locks before starting
echo "$(date): Cleaning up stale X server locks..." >> /var/log/scraper/scheduler.log
rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true

# Kill any existing Xvfb processes on display 99
pkill -f "Xvfb :99" 2>/dev/null || true
sleep 1

# Start virtual display for headful browser
Xvfb :99 -screen 0 1920x1080x16 -nolisten tcp -dpi 96 +extension GLX +render -noreset &
XVFB_PID=$!

# Ensure we clean up Xvfb on script exit (success or failure)
cleanup() {
    echo "$(date): Cleaning up Xvfb process..." >> /var/log/scraper/scheduler.log
    kill $XVFB_PID 2>/dev/null || true
    rm -f /tmp/.X99-lock /tmp/.X11-unix/X99 2>/dev/null || true
}
trap cleanup EXIT

# Wait for display to be ready
sleep 3

cd /app/scraper

# Run all scrapers with save flag - with timeout of 2 hours
echo "$(date): Running scrapers with 2-hour timeout..." >> /var/log/scraper/scheduler.log
timeout 7200 bun run cli all --save --telegram 2>&1 | tee -a /var/log/scraper/scheduler.log || {
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 124 ]; then
        echo "$(date): ERROR - Scraper execution timed out after 2 hours" >> /var/log/scraper/scheduler.log
    else
        echo "$(date): ERROR - Scraper execution failed with exit code $EXIT_CODE" >> /var/log/scraper/scheduler.log
    fi
    exit $EXIT_CODE
}

echo "$(date): Scraper execution completed successfully" >> /var/log/scraper/scheduler.log