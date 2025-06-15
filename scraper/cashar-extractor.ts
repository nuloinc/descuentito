#!/usr/bin/env bun

import { writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { generateUniqueDiscountKeys } from './lib/discount-keys/discount-keys.js';

interface CasharDiscount {
  store: string;
  discount: string;
  paymentMethod: string;
  day: string;
  conditions?: string;
  source: 'cashar.pro';
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

// Google Sheets URLs found in cashar.pro/cashback
const CASHAR_SHEETS = [
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTARZt6d9-so9FfY8w0a8mE454Ygegw1GwfdfeX2KqdTU11SCaV2Es-jmGNjspBcDO7VCdKUCvwvh4z/pubhtml?gid=347859634&single=true',
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTARZt6d9-so9FfY8w0a8mE454Ygegw1GwfdfeX2KqdTU11SCaV2Es-jmGNjspBcDO7VCdKUCvwvh4z/pubhtml?gid=1181745328&single=true',
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTARZt6d9-so9FfY8w0a8mE454Ygegw1GwfdfeX2KqdTU11SCaV2Es-jmGNjspBcDO7VCdKUCvwvh4z/pubhtml?gid=341746925&single=true',
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTARZt6d9-so9FfY8w0a8mE454Ygegw1GwfdfeX2KqdTU11SCaV2Es-jmGNjspBcDO7VCdKUCvwvh4z/pubhtml?gid=620812173&single=true',
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTARZt6d9-so9FfY8w0a8mE454Ygegw1GwfdfeX2KqdTU11SCaV2Es-jmGNjspBcDO7VCdKUCvwvh4z/pubhtml?gid=973607635&single=true',
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTARZt6d9-so9FfY8w0a8mE454Ygegw1GwfdfeX2KqdTU11SCaV2Es-jmGNjspBcDO7VCdKUCvwvh4z/pubhtml?gid=1547716557&single=true',
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTARZt6d9-so9FfY8w0a8mE454Ygegw1GwfdfeX2KqdTU11SCaV2Es-jmGNjspBcDO7VCdKUCvwvh4z/pubhtml?gid=2002645581&single=true'
];

async function fetchSheetData(url: string): Promise<any[]> {
  try {
    console.log(`Fetching: ${url}`);
    const response = await fetch(url);
    const html = await response.text();
    
    // Extract table data from HTML
    const tableRegex = /<table[^>]*>(.*?)<\/table>/gis;
    const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
    const cellRegex = /<t[hd][^>]*>(.*?)<\/t[hd]>/gis;
    
    const tables = html.match(tableRegex) || [];
    const extractedData: any[] = [];
    
    for (const table of tables) {
      const rows = table.match(rowRegex) || [];
      const tableData: string[][] = [];
      
      for (const row of rows) {
        const cells = [];
        let match;
        while ((match = cellRegex.exec(row)) !== null) {
          // Clean HTML tags and decode entities
          let cellText = match[1]
            .replace(/<[^>]*>/g, '') // Remove HTML tags
            .replace(/&nbsp;/g, ' ')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .trim();
          cells.push(cellText);
        }
        cellRegex.lastIndex = 0;
        
        if (cells.length > 0) {
          tableData.push(cells);
        }
      }
      
      if (tableData.length > 0) {
        extractedData.push(tableData);
      }
    }
    
    return extractedData;
  } catch (error) {
    console.error(`Error fetching ${url}:`, error);
    return [];
  }
}

function parseDiscountData(tableData: string[][]): CasharDiscount[] {
  const discounts: CasharDiscount[] = [];
  
  for (const table of tableData) {
    if (table.length < 2) continue; // Skip empty tables
    
    const headers = table[0].map(h => h.toLowerCase());
    const rows = table.slice(1);
    
    for (const row of rows) {
      if (row.length < 2 || !row.some(cell => cell.trim())) continue;
      
      // Try to identify discount information
      const discount: Partial<CasharDiscount> = {
        source: 'cashar.pro' as const
      };
      
      // Look for store names, discounts, payment methods
      for (let i = 0; i < row.length; i++) {
        const cell = row[i].trim();
        if (!cell) continue;
        
        // Detect store names
        if (cell.match(/\b(coto|carrefour|jumbo|dia|makro|disco|vea|changomas|maxiconsumo|vital|anonima|diarco)\b/i)) {
          discount.store = cell;
        }
        
        // Detect discount percentages
        if (cell.match(/\d+%|\d+\s*por\s*ciento/i)) {
          discount.discount = cell;
        }
        
        // Detect payment methods
        if (cell.match(/\b(visa|mastercard|amex|cabal|tarjeta|banco|modo|qr|efectivo|credito|debito)\b/i)) {
          discount.paymentMethod = cell;
        }
        
        // Detect days
        if (cell.match(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)) {
          discount.day = cell;
        }
      }
      
      // Only add if we have meaningful data
      if (discount.store || discount.discount) {
        discounts.push(discount as CasharDiscount);
      }
    }
  }
  
  return discounts;
}

async function loadOurDiscounts(): Promise<OurDiscount[]> {
  const dataDir = '../../descuentito-data';
  const files = readdirSync(dataDir).filter(f => f.endsWith('.json') && !f.includes('scrapped'));
  
  const allDiscounts: OurDiscount[] = [];
  
  for (const file of files) {
    try {
      const content = readFileSync(join(dataDir, file), 'utf-8');
      const discounts = JSON.parse(content) as OurDiscount[];
      
      // Add source if missing
      const source = file.replace('.json', '');
      discounts.forEach(d => {
        if (!d.source) d.source = source;
      });
      
      allDiscounts.push(...discounts);
    } catch (error) {
      console.error(`Error reading ${file}:`, error);
    }
  }
  
  return allDiscounts;
}

function normalizeStoreName(store: string): string {
  return store.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[áàâã]/g, 'a')
    .replace(/[éèê]/g, 'e')
    .replace(/[íìî]/g, 'i')
    .replace(/[óòôõ]/g, 'o')
    .replace(/[úùû]/g, 'u');
}

function compareDiscounts(casharDiscounts: CasharDiscount[], ourDiscounts: OurDiscount[]) {
  console.log('\n=== CASHAR.PRO DISCOUNT ANALYSIS ===');
  console.log(`Total Cashar discounts found: ${casharDiscounts.length}`);
  
  // Extract unique stores from both sources
  const casharStores = new Set(
    casharDiscounts
      .filter(d => d.store)
      .map(d => normalizeStoreName(d.store))
  );
  
  const ourStores = new Set(
    ourDiscounts.map(d => normalizeStoreName(d.source))
  );
  
  console.log('\n=== STORE COVERAGE COMPARISON ===');
  console.log('Cashar.pro stores:', Array.from(casharStores).sort());
  console.log('Our stores:', Array.from(ourStores).sort());
  
  // Find missing stores
  const missingFromUs = Array.from(casharStores).filter(store => 
    !Array.from(ourStores).some(ourStore => 
      ourStore.includes(store) || store.includes(ourStore)
    )
  );
  
  const extraInOurs = Array.from(ourStores).filter(ourStore =>
    !Array.from(casharStores).some(casharStore =>
      ourStore.includes(casharStore) || casharStore.includes(ourStore)
    )
  );
  
  console.log('\n=== MISSING FROM OUR SYSTEM ===');
  missingFromUs.forEach(store => console.log(`❌ ${store}`));
  
  console.log('\n=== EXTRA IN OUR SYSTEM ===');
  extraInOurs.forEach(store => console.log(`✅ ${store}`));
  
  // Sample cashar discounts
  console.log('\n=== SAMPLE CASHAR DISCOUNTS ===');
  casharDiscounts.slice(0, 10).forEach(discount => {
    console.log(`${discount.store || 'Unknown'}: ${discount.discount || 'N/A'} - ${discount.paymentMethod || 'N/A'} - ${discount.day || 'N/A'}`);
  });
  
  // Generate keys for comparison
  console.log('\n=== DISCOUNT KEY ANALYSIS ===');
  console.log(`Our total discounts: ${ourDiscounts.length}`);
  const ourKeys = generateUniqueDiscountKeys(ourDiscounts);
  console.log(`Our unique keys: ${ourKeys.length}`);
  
  return {
    casharDiscounts,
    ourDiscounts,
    missingStores: missingFromUs,
    extraStores: extraInOurs,
    casharStores: Array.from(casharStores),
    ourStores: Array.from(ourStores)
  };
}

async function main() {
  console.log('🔍 Extracting Cashar.pro discount data...\n');
  
  const allCasharData: CasharDiscount[] = [];
  
  // Fetch all sheets
  for (let i = 0; i < CASHAR_SHEETS.length; i++) {
    console.log(`\n📋 Processing sheet ${i + 1}/${CASHAR_SHEETS.length}`);
    const tableData = await fetchSheetData(CASHAR_SHEETS[i]);
    const discounts = parseDiscountData(tableData);
    
    console.log(`Found ${discounts.length} potential discounts in sheet ${i + 1}`);
    allCasharData.push(...discounts);
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Save raw cashar data
  writeFileSync('cashar-raw-data.json', JSON.stringify(allCasharData, null, 2));
  console.log(`\n💾 Saved ${allCasharData.length} Cashar discount entries to cashar-raw-data.json`);
  
  // Load our discount data
  console.log('\n📊 Loading our discount data...');
  const ourDiscounts = await loadOurDiscounts();
  
  // Compare the data
  const comparison = compareDiscounts(allCasharData, ourDiscounts);
  
  // Save comparison report
  const report = {
    timestamp: new Date().toISOString(),
    casharDataCount: allCasharData.length,
    ourDataCount: ourDiscounts.length,
    missingStores: comparison.missingStores,
    extraStores: comparison.extraStores,
    casharStores: comparison.casharStores,
    ourStores: comparison.ourStores,
    casharSamples: allCasharData.slice(0, 20),
    recommendations: comparison.missingStores.map(store => 
      `Consider adding scraper for: ${store}`
    )
  };
  
  writeFileSync('cashar-comparison-report.json', JSON.stringify(report, null, 2));
  console.log('\n📈 Saved comparison report to cashar-comparison-report.json');
  
  console.log('\n✅ Analysis complete!');
}

if (import.meta.main) {
  main().catch(console.error);
}