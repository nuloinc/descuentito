# Descuentito Justfile

install:
    bun install

test:
    cd scraper && bun run test

check:
    cd scraper && bun run check
    cd sitio && bun run check