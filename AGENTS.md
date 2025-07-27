# AGENTS.md

## Build/Lint/Test Commands

### Root
- `bun install` - Install dependencies

### Scraper
- `bun run check` - TypeScript check
- `bun run test` - Run all tests
- `bun run test <filename>` - Run single test
- `bun run format` - Prettier format
- `bun run cli <scraper>` - Run scraper

### Frontend
- `bun run dev` - Start dev server
- `bun run build` - Build for production
- `bun run test` - Run tests
- `bun run format` - Prettier format

## Project Structure & Data Flow

### scraper/
Web scraper using Playwright + LLM for extracting promotion data from Argentine supermarkets (carrefour, coto, dia, jumbo, changomas, makro)

### promos-db/
Shared database schema and types defining discount structures with 140+ Argentine payment methods

### sitio/
TanStack Start React frontend for displaying discounts, using Shadcn UI components

### Data Flow Pipeline
1. **Scraping**: Individual scrapers extract raw DOM → LLM processes into `GenericDiscount` objects
2. **Storage**: `scraper/lib/git.ts` saves to GitHub repo `nuloinc/descuentito-data` as `{supermarket}.json`
3. **Distribution**: JSON files served via GitHub raw URLs
4. **Frontend Fetching**: `sitio/src/server/promotions.ts` multi-tier fallback:
   - Cloudflare KV (production)
   - Local `../descuentito-data/` (development)
   - GitHub raw URLs (fallback)
5. **Real-time**: `getPromotions()` fetches latest data per supermarket via `SOURCES` array

## Code Style
- **Package Manager**: Always use `bun`/`bunx` (see .cursor/rules/use-bun.mdc)
- **React**: Use Shadcn UI components (.cursor/rules/use-shadcn.mdc)
- **Formatting**: Prettier with 2-space indentation
- **Imports**: Use ES modules, prefer named exports
- **Types**: Strict TypeScript, Zod schemas for validation
- **Naming**: camelCase for variables/functions, PascalCase for components
- **Error Handling**: Use try/catch with proper error logging
- **Testing**: Vitest for scraper, bun test for frontend