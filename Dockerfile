# Descuentito Scraper - Scheduled Docker Container
FROM ubuntu:22.04

# Set timezone to UTC-3 (Buenos Aires)
ENV TZ=America/Argentina/Buenos_Aires
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    unzip \
    cron \
    tzdata \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    xvfb \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js (required for bun installation)
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install bun package manager
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

# Create app directory
WORKDIR /app

# Copy package files and patches first for better layer caching
COPY package.json bun.lock* ./
COPY scraper/package.json ./scraper/
COPY promos-db/package.json ./promos-db/
COPY sitio/package.json ./sitio/
COPY patches/ ./patches/

# Install dependencies
RUN bun install

# Copy application code
COPY . .

# Install Playwright browsers (headful mode)
RUN cd scraper && bunx playwright install --with-deps chromium

# Create logs directory
RUN mkdir -p /var/log/scraper

# Copy and set up scripts
COPY infra/run-scraper.sh /usr/local/bin/run-scraper.sh
COPY infra/start-container.sh /usr/local/bin/start-container.sh
RUN chmod +x /usr/local/bin/run-scraper.sh /usr/local/bin/start-container.sh

# Create cron job for Mondays and Fridays at 9:00 AM UTC-3
RUN echo "0 9 * * 1,5 /usr/local/bin/run-scraper.sh" > /etc/cron.d/scraper-schedule

# Give execution permissions on the cron job
RUN chmod 0644 /etc/cron.d/scraper-schedule

# Apply cron job
RUN crontab /etc/cron.d/scraper-schedule


# Environment variables (override these when running container)
ENV HEADLESS=false
ENV LOCAL_BROWSER=true
ENV UNATTENDED_MODE=true
ENV FETCH_CACHER_REGION=us-west-002
ENV FETCH_CACHER_BUCKET_NAME=your_bucket
ENV FETCH_CACHER_ENDPOINT=https://s3.us-west-002.backblazeb2.com

# Expose any ports if needed (not required for this scraper)
# EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD ps aux | grep -v grep | grep cron || exit 1

# Run the startup script
CMD ["/usr/local/bin/start-container.sh"]