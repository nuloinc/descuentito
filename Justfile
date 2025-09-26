install:
    bun install

test:
    cd scraper && bun run test

check:
    cd scraper && bun run check
    cd sitio && bun run check

cli *ARGS:
    cd scraper && bun run cli {{ARGS}}

deploy:
    just sync-compose
    docker build -t descuentito/scraper --platform linux/amd64 .
    docker-pussh descuentito/scraper absolute-slop
    ssh absolute-slop "cd descuentito/ && docker compose up -d"

sync-compose:
    ssh absolute-slop mkdir -p descuentito
    scp docker-compose.yml .env.production absolute-slop:descuentito/


run-once:
    just sync-compose
    ssh absolute-slop "cd descuentito/ && env RUN_MODE=once docker compose up"
    ssh absolute-slop "cd descuentito/ && docker compose up -d"
