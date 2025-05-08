#!/usr/bin/env bun
import {
  scrapeJumbo,
  scrapeMakro,
  scrapeDia,
  scrapeCarrefour,
  scrapeChangoMas,
  scrapeCoto,
} from "./scrapers";

const scrapers = {
  jumbo: scrapeJumbo,
  makro: scrapeMakro,
  dia: scrapeDia,
  carrefour: scrapeCarrefour,
  changomas: scrapeChangoMas,
  coto: scrapeCoto,
} as const;

type ScraperName = keyof typeof scrapers;

async function main() {
  const scraperName = process.argv[2] as ScraperName;

  if (!scraperName) {
    console.error("Please provide a scraper name");
    console.error("Available scrapers:", Object.keys(scrapers).join(", "));
    process.exit(1);
  }

  const scraper = scrapers[scraperName];
  if (!scraper) {
    console.error(`Unknown scraper: ${scraperName}`);
    console.error("Available scrapers:", Object.keys(scrapers).join(", "));
    process.exit(1);
  }

  try {
    const results = await scraper();
    console.log(JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("Error running scraper:", error);
    process.exit(1);
  }
}

if ((import.meta as any).main) {
  main();
}
