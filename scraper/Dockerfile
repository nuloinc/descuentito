# https://stephenhaney.com/2024/playwright-on-fly-io-with-bun/
# Use the official playwright docker image
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

RUN apt-get update && apt-get install -y \
    unzip \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH=$PATH:/root/.bun/bin

RUN corepack enable

WORKDIR /app
COPY . .

RUN pnpm install
RUN npx puppeteer browsers install chrome

WORKDIR /app/scraper

CMD ["xvfb-run", "bun", "run", "cli", "all", "--save"]
