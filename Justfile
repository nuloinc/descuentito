install:
    bun install

test:
    cd scraper && bun run test

check:
    cd scraper && bun run check
    cd sitio && bun run check

cli *ARGS:
    cd scraper && bun run cli {{ARGS}}

# Builds on the server (the image is ~2.7 GB, too big to push from a laptop)
# and rolls out with Uncloud. Set DEPLOY_SSH=user@host of the Uncloud machine.
deploy:
    #!/usr/bin/env bash
    set -euo pipefail
    server="${DEPLOY_SSH:?set DEPLOY_SSH=user@host of the Uncloud machine}"
    rsync -az --delete --exclude node_modules --exclude .git --exclude .uncloud --exclude '.env*' ./ "$server:src/descuentito/"
    ssh "$server" "cd src/descuentito && docker build -t descuentito/scraper:latest ."
    uc deploy -f uncloud.yaml --no-build --recreate -y

run-once:
    uc exec descuentito-scraper /usr/local/bin/run-scraper.sh

logs:
    uc logs -f descuentito-scraper
