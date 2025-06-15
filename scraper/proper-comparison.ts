#!/usr/bin/env bun

import { readFileSync } from "fs";
import { generateDiscountKey } from "./lib/discount-keys/discount-keys.js";

interface CasharDiscount {
  store?: string;
  discount?: string;
  paymentMethod?: string;
  day?: string;
  conditions?: string;
  source: "cashar.pro";
}

interface OurDiscount {
  source: string;
  discount: {
    type: string;
    value: number;
  };
  validFrom: string;
  validUntil: string;
  paymentMethods: string[][];
  restrictions?: string[];
  excludesProducts?: string;
  weekdays?: string[];
}

interface StructuredDiscount {
  store: string;
  percentage: number;
  paymentMethod: string;
  weekday: string;
  restrictions?: string;
  source: "cashar" | "our";
  originalData: CasharDiscount | OurDiscount;
}

// Google Sheets URLs with their GIDs to determine weekdays
const CASHAR_SHEETS_WITH_DAYS = [
  { gid: "347859634", day: "Monday" },
  { gid: "1181745328", day: "Tuesday" },
  { gid: "341746925", day: "Wednesday" },
  { gid: "620812173", day: "Thursday" },
  { gid: "973607635", day: "Friday" },
  { gid: "1547716557", day: "Saturday" },
  { gid: "2002645581", day: "Sunday" },
];

function normalizeStoreName(store: string): string {
  return store
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/online|express|maxi|\+/g, "")
    .replace(/[áàâã]/g, "a")
    .replace(/[éèê]/g, "e")
    .replace(/[íìî]/g, "i")
    .replace(/[óòôõ]/g, "o")
    .replace(/[úùû]/g, "u");
}

function normalizePaymentMethod(payment: string): string {
  const normalized = payment
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/🔥/g, "")
    .replace(/tarjeta/g, "")
    .replace(/card/g, "")
    .replace(/credito|crédito/g, "cred")
    .replace(/debito|débito/g, "deb")
    .replace(/banco/g, "")
    .replace(/de/g, "");
  
  // Normalize card types to broad categories
  if (normalized.includes('mastercard') || normalized.includes('master')) {
    return 'master';
  }
  if (normalized.includes('visa')) {
    return 'visa';
  }
  if (normalized.includes('amex') || normalized.includes('americanexpress')) {
    return 'amex';
  }
  if (normalized.includes('mercadopago') || normalized.includes('mercado')) {
    return 'mercadopago';
  }
  if (normalized.includes('modo')) {
    return 'modo';
  }
  if (normalized.includes('any') || payment.trim() === '') {
    return 'any';
  }
  
  return normalized;
}

function normalizeWeekday(day: string): string {
  const dayMap: Record<string, string> = {
    monday: "lunes",
    tuesday: "martes",
    wednesday: "miercoles",
    thursday: "jueves",
    friday: "viernes",
    saturday: "sabado",
    sunday: "domingo",
    lunes: "lunes",
    martes: "martes",
    miercoles: "miercoles",
    jueves: "jueves",
    viernes: "viernes",
    sabado: "sabado",
    domingo: "domingo",
  };
  return dayMap[day.toLowerCase()] || day.toLowerCase();
}

function extractDiscountValue(discountStr: string): number | null {
  const match = discountStr.match(/(\d+)%/);
  return match ? parseInt(match[1]) : null;
}

async function fetchSheetsByDay(): Promise<Record<string, CasharDiscount[]>> {
  console.log("🔍 Fetching Cashar data by weekday...\n");

  const dataByDay: Record<string, CasharDiscount[]> = {};

  for (const sheet of CASHAR_SHEETS_WITH_DAYS) {
    const url = `https://docs.google.com/spreadsheets/d/e/2PACX-1vTARZt6d9-so9FfY8w0a8mE454Ygegw1GwfdfeX2KqdTU11SCaV2Es-jmGNjspBcDO7VCdKUCvwvh4z/pubhtml?gid=${sheet.gid}&single=true`;

    try {
      console.log(`📋 Fetching ${sheet.day} (gid: ${sheet.gid})`);
      const response = await fetch(url);
      const html = await response.text();

      // Extract table data from HTML
      const tableRegex = /<table[^>]*>(.*?)<\/table>/gis;
      const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
      const cellRegex = /<t[hd][^>]*>(.*?)<\/t[hd]>/gis;

      const tables = html.match(tableRegex) || [];
      const dayDiscounts: CasharDiscount[] = [];

      for (const table of tables) {
        const rows = table.match(rowRegex) || [];

        for (const row of rows) {
          const cells = [];
          let match;
          while ((match = cellRegex.exec(row)) !== null) {
            let cellText = match[1]
              .replace(/<[^>]*>/g, "")
              .replace(/&nbsp;/g, " ")
              .replace(/&amp;/g, "&")
              .replace(/&lt;/g, "<")
              .replace(/&gt;/g, ">")
              .trim();
            cells.push(cellText);
          }
          cellRegex.lastIndex = 0;

          if (cells.length >= 3 && cells.some((cell) => cell.includes("%"))) {
            // Parse structured table: [index, store, payment_method, discount%, ...]
            const discount: Partial<CasharDiscount> = {
              source: "cashar.pro" as const,
              day: sheet.day,
            };

            // Look for discount percentage
            const discountCell = cells.find(cell => cell.match(/\d+%/));
            if (discountCell) discount.discount = discountCell;

            // Look for store name
            const storeCell = cells.find(cell => 
              cell.match(/\b(coto|carrefour|jumbo|dia|makro|disco|vea|changomas)\b/i)
            );
            if (storeCell) discount.store = storeCell;

            // Look for payment method in any cell (more flexible)
            const paymentCell = cells.find(cell => 
              cell && cell.length > 2 && 
              (cell.match(/\b(visa|mastercard|amex|banco|modo|qr|mercado|reba|ciudad|santander|macro|bbva|galicia|patagonia|crédito|credito|débito|debito)\b/i) ||
               cell.includes("Crédito") || cell.includes("Débito") || cell.includes("QR"))
            );
            if (paymentCell) discount.paymentMethod = paymentCell;

            // If we have store and discount, include it
            if (discount.discount && discount.store) {
              dayDiscounts.push(discount as CasharDiscount);
            }
          }
        }
      }

      dataByDay[sheet.day] = dayDiscounts;
      console.log(`   Found ${dayDiscounts.length} discounts for ${sheet.day}`);

      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`❌ Error fetching ${sheet.day}:`, error);
      dataByDay[sheet.day] = [];
    }
  }

  return dataByDay;
}

function structureCasharData(
  dataByDay: Record<string, CasharDiscount[]>,
): StructuredDiscount[] {
  const structured: StructuredDiscount[] = [];

  for (const [day, discounts] of Object.entries(dataByDay)) {
    for (const discount of discounts) {
      const percentage = extractDiscountValue(discount.discount || "");
      if (!percentage || !discount.store) continue;

      const normalizedStore = normalizeStoreName(discount.store);

      // Filter for our tracked supermarkets
      const trackedStores = [
        "carrefour",
        "coto",
        "dia",
        "jumbo",
        "changomas",
        "makro",
      ];
      const matchingStore = trackedStores.find(
        (store) =>
          normalizedStore.includes(store) ||
          discount.store!.toLowerCase().includes(store),
      );

      if (matchingStore) {
        structured.push({
          store: matchingStore,
          percentage,
          paymentMethod: normalizePaymentMethod(
            discount.paymentMethod || "any",
          ),
          weekday: normalizeWeekday(day),
          restrictions: discount.conditions,
          source: "cashar",
          originalData: discount,
        });
      }
    }
  }

  return structured;
}

function structureOurData(): StructuredDiscount[] {
  const structured: StructuredDiscount[] = [];
  const stores = ["carrefour", "coto", "dia", "jumbo", "changomas", "makro"];

  for (const store of stores) {
    try {
      const data: OurDiscount[] = JSON.parse(
        readFileSync(`../../descuentito-data/${store}.json`, "utf-8"),
      );

      for (const discount of data) {
        const weekdays = discount.weekdays || ["all"];
        const paymentMethods = discount.paymentMethods || [["any"]];

        // Create entry for each weekday and payment method combination
        for (const weekday of weekdays) {
          for (const paymentMethodGroup of paymentMethods) {
            const paymentMethod = paymentMethodGroup.join("+");

            structured.push({
              store,
              percentage: discount.discount.value,
              paymentMethod: normalizePaymentMethod(paymentMethod),
              weekday: normalizeWeekday(weekday),
              restrictions: discount.restrictions?.join("; "),
              source: "our",
              originalData: discount,
            });
          }
        }
      }
    } catch (error) {
      console.log(`⚠️ Could not load ${store}.json`);
    }
  }

  return structured;
}

function createComparisonKey(discount: StructuredDiscount): string {
  return `${discount.store}-${discount.percentage}%-${discount.weekday}-${discount.paymentMethod}`;
}

function createFlexibleComparisonKey(discount: StructuredDiscount): string {
  // More flexible key that ignores weekday for broader matching
  return `${discount.store}-${discount.percentage}%-${discount.paymentMethod}`;
}

function compareStructuredData(
  casharData: StructuredDiscount[],
  ourData: StructuredDiscount[],
) {
  console.log("\n🔍 STRUCTURED DATA COMPARISON\n");

  // Create lookup objects
  const casharByStore: Record<string, StructuredDiscount[]> = {};
  const ourByStore: Record<string, StructuredDiscount[]> = {};

  casharData.forEach((d) => {
    if (!casharByStore[d.store]) casharByStore[d.store] = [];
    casharByStore[d.store].push(d);
  });

  ourData.forEach((d) => {
    if (!ourByStore[d.store]) ourByStore[d.store] = [];
    ourByStore[d.store].push(d);
  });

  console.log("📊 OVERVIEW:");
  console.log(`Cashar total entries: ${casharData.length}`);
  console.log(`Our total entries: ${ourData.length}`);

  // Create sets of comparison keys
  const casharKeys = new Set(casharData.map(createComparisonKey));
  const ourKeys = new Set(ourData.map(createComparisonKey));

  console.log(`Cashar unique combinations: ${casharKeys.size}`);
  console.log(`Our unique combinations: ${ourKeys.size}\n`);

  // Find missing and extra (exact match)
  const missingFromUs = casharData.filter(
    (c) => !ourKeys.has(createComparisonKey(c)),
  );
  const extraInOurs = ourData.filter(
    (o) => !casharKeys.has(createComparisonKey(o)),
  );

  // Also do flexible comparison (ignoring weekdays)
  const casharFlexibleKeys = new Set(casharData.map(createFlexibleComparisonKey));
  const ourFlexibleKeys = new Set(ourData.map(createFlexibleComparisonKey));
  
  const missingFlexible = casharData.filter(
    (c) => !ourFlexibleKeys.has(createFlexibleComparisonKey(c)),
  );
  const matchedFlexible = casharData.filter(
    (c) => ourFlexibleKeys.has(createFlexibleComparisonKey(c)),
  );

  console.log("🏪 BY STORE ANALYSIS:");
  const stores = ["carrefour", "coto", "dia", "jumbo", "changomas", "makro"];

  for (const store of stores) {
    const casharForStore = casharByStore[store] || [];
    const ourForStore = ourByStore[store] || [];
    const missingForStore = missingFromUs.filter((m) => m.store === store);

    console.log(`\n📋 ${store.toUpperCase()}:`);
    console.log(`   Cashar: ${casharForStore.length} entries`);
    console.log(`   Ours: ${ourForStore.length} entries`);
    console.log(`   Missing: ${missingForStore.length} entries`);

    if (missingForStore.length > 0) {
      console.log("   🔍 Missing details:");
      missingForStore.forEach((m) => {
        const original = m.originalData as CasharDiscount;
        console.log(
          `      • ${m.percentage}% on ${m.weekday} with ${m.paymentMethod}`,
        );
        console.log(
          `        Source: "${original.store}" - "${original.discount}" - "${original.paymentMethod || "Any"}"`,
        );
      });
    }
  }

  console.log("\n📈 SUMMARY:");
  console.log(`Total missing opportunities (exact): ${missingFromUs.length}`);
  console.log(`Total missing (flexible - ignoring weekdays): ${missingFlexible.length}`);
  console.log(`Total matched (flexible): ${matchedFlexible.length}`);
  console.log(`Total extra in our system: ${extraInOurs.length}`);
  
  if (matchedFlexible.length > 0) {
    console.log("\n✅ FLEXIBLE MATCHES (same store/percentage/payment, different weekday):");
    matchedFlexible.slice(0, 10).forEach((match, i) => {
      const original = match.originalData as CasharDiscount;
      console.log(`${i + 1}. ${match.store.toUpperCase()} - ${match.percentage}% with ${match.paymentMethod}`);
      console.log(`   Cashar: ${match.weekday} - "${original.store}"`);
      
      // Find our matching entries
      const ourMatches = ourData.filter(o => 
        createFlexibleComparisonKey(o) === createFlexibleComparisonKey(match)
      );
      ourMatches.slice(0, 2).forEach(ourMatch => {
        console.log(`   Ours: ${ourMatch.weekday} - ${ourMatch.paymentMethod}`);
      });
    });
  }

  if (missingFromUs.length > 0) {
    console.log("\n🎯 TOP MISSING OPPORTUNITIES:");
    const sortedMissing = missingFromUs.sort(
      (a, b) => b.percentage - a.percentage,
    );
    sortedMissing.slice(0, 10).forEach((missing, i) => {
      const original = missing.originalData as CasharDiscount;
      console.log(
        `${i + 1}. ${missing.store.toUpperCase()} - ${missing.percentage}% on ${missing.weekday}`,
      );
      console.log(`   Payment: ${missing.paymentMethod}`);
      console.log(`   Source: "${original.store}"`);
    });
  }

  return {
    casharTotal: casharData.length,
    ourTotal: ourData.length,
    missing: missingFromUs.length,
    extra: extraInOurs.length,
    missingDetails: missingFromUs,
  };
}

async function main() {
  console.log("🔍 PROPER CASHAR.PRO COMPARISON WITH WEEKDAY STRUCTURE\n");

  // Fetch cashar data organized by weekday
  const casharByDay = await fetchSheetsByDay();

  // Structure the data properly
  console.log("\n📊 Structuring data...");
  const casharStructured = structureCasharData(casharByDay);
  const ourStructured = structureOurData();

  console.log(`Cashar structured entries: ${casharStructured.length}`);
  console.log(`Our structured entries: ${ourStructured.length}`);

  // Show sample structured data
  console.log("\n🔍 SAMPLE CASHAR STRUCTURED DATA:");
  casharStructured.slice(0, 5).forEach((item, i) => {
    const original = item.originalData as CasharDiscount;
    console.log(
      `${i + 1}. ${item.store} - ${item.percentage}% on ${item.weekday} with ${item.paymentMethod}`,
    );
    console.log(
      `   Original: "${original.store}" - "${original.discount}" - "${original.paymentMethod || "Any"}"`,
    );
  });

  console.log("\n🔍 SAMPLE OUR STRUCTURED DATA:");
  ourStructured.slice(0, 5).forEach((item, i) => {
    console.log(
      `${i + 1}. ${item.store} - ${item.percentage}% on ${item.weekday} with ${item.paymentMethod}`,
    );
  });

  // Perform the comparison
  const comparison = compareStructuredData(casharStructured, ourStructured);

  // Save detailed results
  const report = {
    timestamp: new Date().toISOString(),
    casharByDay,
    casharStructured,
    ourStructured: ourStructured.slice(0, 50), // Limit size
    comparison,
    recommendations:
      comparison.missing > 0
        ? [
            "Review missing discount opportunities above",
            "Verify if these represent actual gaps in our scrapers",
            "Consider if these are one-time promotions vs recurring offers",
          ]
        : ["Excellent coverage! No significant gaps detected."],
  };

  require("fs").writeFileSync(
    "proper-comparison-report.json",
    JSON.stringify(report, null, 2),
  );
  console.log("\n💾 Detailed report saved to proper-comparison-report.json");
}

if (import.meta.main) {
  main().catch(console.error);
}
