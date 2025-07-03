# Running the Scraper Without Credentials

This guide shows you how to run the scraper as a background agent without requiring any API keys or secrets.

## What Works Without Credentials

✅ **Real Web Scraping**: Visits actual websites and extracts DOM content  
✅ **Complete Flow Demonstration**: Shows all scraper steps and outputs  
✅ **Mock Services**: Gracefully handles missing credentials with mock responses  

## What Gets Mocked

When credentials are missing, these services automatically switch to mock mode:

- **AWS S3**: Caching is disabled, logs what would be uploaded
- **OpenRouter API**: Uses realistic mock LLM responses instead of real AI
- **GitHub**: Logs what commits/PRs would be created
- **Telegram**: Logs what notifications would be sent
- **Proxy Services**: Uses direct connections instead of proxies

## Running the Demo

### Option 1: Demo DIA Scraper (Recommended)
```bash
cd scraper
bun run cli demo-dia
```

This will:
1. 🌐 Scrape real DIA promotion pages
2. 📋 Extract DOM content and legal text
3. 🤖 Generate mock discount data (instead of using LLM)
4. 📁 Log mock git operations
5. 📱 Log mock notifications

### Option 2: Regular Scrapers (Will Use Mocks When Needed)
```bash
cd scraper
bun run cli dia        # DIA scraper
bun run cli jumbo      # Jumbo scraper  
bun run cli makro      # Makro scraper
# etc...
```

### Option 3: All Scrapers
```bash
cd scraper
bun run cli all
```

## Expected Output

You'll see output like:
```
⚠️  S3 credentials not found - caching will be disabled
⚠️  OpenRouter API key not found - using mock LLM responses  
⚠️  GitHub credentials not found - git operations will be disabled
🌐 Scraping DIA promotions from: https://diaonline.supermercadosdia.com.ar/medios-de-pago-y-promociones
🔍 Found 8 promotion elements to scrape
✅ Scraped promotion 1/8
✅ Scraped promotion 2/8
...
🤖 [NO-CREDS] Using mock LLM responses for 8 scraped promotions
🎯 [NO-CREDS] Generated 8 mock DIA discounts
📁 [NO-CREDS] Mock git initialized for demo-dia
📊 [NO-CREDS] Updated discount count for demo-dia: 8
🔄 [NO-CREDS] Would commit 8 discounts for demo-dia
📤 [NO-CREDS] Would push to GitHub and create PR
```

## Dependencies Required

The scraper needs these installed:
- **Bun runtime**
- **Playwright** (for web scraping)

To install:
```bash
cd scraper
bun install
npx playwright install chromium
```

## Benefits for Background Agents

- ✅ **No secrets required** - Safe to run in any environment
- ✅ **Shows real functionality** - Demonstrates actual scraping capabilities  
- ✅ **Complete flow visibility** - See all inputs and outputs
- ✅ **Production-like behavior** - Same code paths as real usage
- ✅ **Educational** - Understand how the scraper works end-to-end

The scraper automatically detects missing credentials and switches to demo mode, making it perfect for background agents to explore and understand the system without any setup.