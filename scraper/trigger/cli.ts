#!/usr/bin/env bun
import {
  scrapeJumbo,
  scrapeMakro,
  scrapeDia,
  scrapeCarrefour,
  scrapeChangoMas,
  scrapeCoto,
} from "./scrapers";
import { savePromotions } from "../lib/git";

const scrapers = {
  jumbo: scrapeJumbo,
  makro: scrapeMakro,
  dia: scrapeDia,
  carrefour: scrapeCarrefour,
  changomas: scrapeChangoMas,
  coto: scrapeCoto,
} as const;

type ScraperName = keyof typeof scrapers;

async function processScraperResults(
  scraperName: string,
  results: any,
  saveFlag: boolean
) {
  if (saveFlag) {
    await savePromotions(undefined, scraperName, results);
    console.log(`Promotions saved for ${scraperName}`);
  } else {
    console.log(JSON.stringify(results, null, 2));
  }
}

async function main() {
  const scraperName = process.argv[2] as ScraperName | "all";
  const saveFlag = process.argv.includes("--save");

  if (!scraperName) {
    console.error("Please provide a scraper name");
    console.error("Available scrapers:", Object.keys(scrapers).join(", "));
    process.exit(1);
  }

  if (scraperName === "all") {
    for (const [name, scraper] of Object.entries(scrapers)) {
      try {
        console.log(`Running ${name} scraper...`);
        const results = await scraper();
        await processScraperResults(name, results, saveFlag);
      } catch (error) {
        console.error(`Error running ${name} scraper:`, error);
      }
    }
    return;
  }

  const scraper = scrapers[scraperName];
  if (!scraper) {
    console.error(`Unknown scraper: ${scraperName}`);
    console.error("Available scrapers:", Object.keys(scrapers).join(", "));
    process.exit(1);
  }

  try {
    const results = await scraper();
    await processScraperResults(scraperName, results, saveFlag);
  } catch (error) {
    console.error("Error running scraper:", error);
    process.exit(1);
  }
}

if ((import.meta as any).main) {
  main();
}
