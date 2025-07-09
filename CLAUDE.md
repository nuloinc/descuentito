# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Descuentito is a monorepo containing a web scraping system for collecting discounts from Argentine supermarket chains and a React frontend for displaying them. The project consists of three main workspaces:

- **scraper/**: Web scraper using Playwright + LLM for extracting promotion data
- **promos-db/**: Shared database schema and types
- **sitio-react/**: TanStack Start React frontend for displaying discounts

## Development Commands

Use **bun** for all package management operations instead of npm/yarn:

### Root Project
```bash
bun install          # Install all workspace dependencies
```

### Scraper (scraper/)
```bash
bun run cli <scraper-name>        # Run specific scraper (carrefour, coto, dia, jumbo, changomas, makro)
bun run cli all                   # Run all scrapers
bun run cli <scraper> --save      # Save results to git
bun run cli <scraper> --skip-extract  # Skip LLM extraction step
bun run check                     # TypeScript check
bun run test                      # Run Vitest tests
```

### Frontend (sitio-react/)
```bash
bun run dev          # Start development server
bun run build        # Build for production
bun run start        # Start with Wrangler (Cloudflare Pages)
```

## Architecture

### Scraper System
The scraper follows a two-phase approach:
1. **Content Scraping**: Playwright navigates websites and extracts DOM content using `generateElementDescription()`
2. **LLM Extraction**: AI models convert raw content into structured `GenericDiscount` objects

Each scraper implements:
- `scrapeContent()`: Returns raw scraped data
- `extractDiscounts()`: Converts content to structured discount data

### Data Flow
1. Scrapers extract raw promotion data from supermarket websites
2. LLM processes content using detailed prompts from `promos-db/schema.ts`
3. Structured data gets saved to git with `useCommit()`
4. Frontend fetches and displays discount data

### Key Components
- **CLI**: `scraper/trigger/cli.ts` - Main entry point for running scrapers
- **Schema**: `promos-db/schema.ts` - Defines discount structure and validation
- **Scrapers**: `scraper/trigger/scrapers/` - Individual supermarket scrapers
- **Frontend**: `sitio-react/src/` - React app using TanStack Router + Query

## Testing

- **Scraper tests**: Located in `scraper/test/` and `scraper/trigger/test/`
- **Test framework**: Vitest with 60-second timeout
- **Snapshots**: DOM snapshots stored in `test/snapshots/` for regression testing

## Important Rules

### Package Management
- Always use `bun` instead of npm/yarn
- Use `bunx` instead of `npx`

### React Components  
- Use Shadcn UI components for consistent styling
- Follow existing component patterns in `sitio-react/src/components/`

### Scraper Development
- Each scraper must implement both `scrapeContent()` and `extractDiscounts()`
- Use `generateElementDescription()` for DOM content extraction
- Follow the structured prompt system from `promos-db/schema.ts`
- Test with `--skip-extract` flag for faster iteration during development

### Environment
- Environment variables loaded via Vite's `loadEnv` in tests
- Proxy support available for scrapers via `useProxy: true`
- OpenTelemetry instrumentation enabled for monitoring

### Feedback System
The frontend includes a feedback system that creates Linear issues from user reports:
- **Linear Integration**: User feedback creates issues in Linear workspace
- **Required Environment Variables**:
  - `LINEAR_API_KEY`: Your Linear API key (get from Linear Settings > API)
  - `LINEAR_TEAM_ID`: Your Linear team ID (found in team URL or via API)
- **Features**: Captures user feedback, PostHog session replays, user config, and discount context
- **Configuration**: Set environment variables in `sitio-react/.env` and Cloudflare Pages

## Payment Methods & Schema

The system supports extensive Argentine payment methods defined in `promos-db/schema.ts`:
- 140+ banks and digital wallets (Mercado Pago, Personal Pay, Uala, etc.)
- Payment rails (VISA, Mastercard, MODO, etc.)
- Complex discount structures with percentage/installment options
- Location-specific applicability (store types, online vs physical)

## Scraper Data Repository

- Scrapped data by the scraper is stored in the `descuentito-data` repo, which is available in ../descuentito-data
- Make sure to merge in origin/main as the local copy is often outdated