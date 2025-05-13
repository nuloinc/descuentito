# https://stephenhaney.com/2024/playwright-on-fly-io-with-bun/
# Use the official playwright docker image
FROM mcr.microsoft.com/playwright:v1.52.0-jammy

# Install unzip and curl (required by bun)
RUN apt-get update && apt-get install -y \
    unzip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install bun
RUN curl -fsSL https://bun.sh/install | bash
ENV PATH=$PATH:/root/.bun/bin

RUN corepack enable

# Set up your app
WORKDIR /app

# Copy the rest of your application
COPY . .

# Build the app
RUN pnpm install

WORKDIR /app/scraper

# Start the app
CMD ["bun", "run", "cli", "all", "--save"]
