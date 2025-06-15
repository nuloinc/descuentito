#!/usr/bin/env bun

import { readFileSync } from 'fs';

interface CasharDiscount {
  store?: string;
  discount?: string;
  paymentMethod?: string;
  day?: string;
  conditions?: string;
  source: 'cashar.pro';
}

async function debugMondayCotoDiscount() {
  console.log('🔍 DEBUGGING MONDAY COTO 25% DISCOUNT\n');
  
  // Fetch Monday sheet specifically
  const mondayUrl = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTARZt6d9-so9FfY8w0a8mE454Ygegw1GwfdfeX2KqdTU11SCaV2Es-jmGNjspBcDO7VCdKUCvwvh4z/pubhtml?gid=347859634&single=true';
  
  console.log('📋 Fetching Monday sheet raw data...');
  const response = await fetch(mondayUrl);
  const html = await response.text();
  
  // Extract table data
  const tableRegex = /<table[^>]*>(.*?)<\/table>/gis;
  const rowRegex = /<tr[^>]*>(.*?)<\/tr>/gis;
  const cellRegex = /<t[hd][^>]*>(.*?)<\/t[hd]>/gis;
  
  const tables = html.match(tableRegex) || [];
  
  console.log(`Found ${tables.length} tables in Monday sheet\n`);
  
  // Look for COTO 25% entries
  let tableIndex = 0;
  for (const table of tables) {
    tableIndex++;
    const rows = table.match(rowRegex) || [];
    
    console.log(`\n📊 TABLE ${tableIndex} (${rows.length} rows):`);
    
    let rowIndex = 0;
    for (const row of rows) {
      rowIndex++;
      const cells = [];
      let match;
      while ((match = cellRegex.exec(row)) !== null) {
        let cellText = match[1]
          .replace(/<[^>]*>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();
        cells.push(cellText);
      }
      cellRegex.lastIndex = 0;
      
      // Check if this row contains COTO and 25%
      const rowText = cells.join(' | ').toLowerCase();
      if ((rowText.includes('coto') || rowText.includes('кото')) && rowText.includes('25%')) {
        console.log(`\n🎯 FOUND COTO 25% IN TABLE ${tableIndex}, ROW ${rowIndex}:`);
        console.log(`Raw cells: [${cells.map(c => `"${c}"`).join(', ')}]`);
        console.log(`Combined text: "${cells.join(' | ')}"`);
        
        // Analyze each cell
        cells.forEach((cell, i) => {
          console.log(`   Cell ${i}: "${cell}"`);
          if (cell.includes('25%')) console.log(`      ↳ Contains discount percentage`);
          if (cell.toLowerCase().includes('coto')) console.log(`      ↳ Contains store name`);
          if (cell.match(/\b(visa|mastercard|amex|banco|modo|qr|mercado|reba|santander|macro|bbva|galicia|patagonia)\b/i)) {
            console.log(`      ↳ Contains payment method: ${cell}`);
          }
        });
      }
    }
  }
  
  // Also check our parsing logic
  console.log('\n🔧 CHECKING OUR PARSING LOGIC:');
  
  // Load the already parsed data to see what we extracted
  const casharData: CasharDiscount[] = JSON.parse(
    readFileSync('cashar-raw-data.json', 'utf-8')
  );
  
  const mondayData = casharData.filter(d => d.day === 'Monday');
  const cotoMondayData = mondayData.filter(d => 
    d.store?.toLowerCase().includes('coto') && d.discount?.includes('25%')
  );
  
  console.log(`\nFound ${cotoMondayData.length} COTO 25% Monday entries in our parsed data:`);
  cotoMondayData.forEach((entry, i) => {
    console.log(`${i + 1}. Store: "${entry.store}"`);
    console.log(`   Discount: "${entry.discount}"`);
    console.log(`   Payment: "${entry.paymentMethod || 'undefined'}"`);
    console.log(`   Day: "${entry.day}"`);
  });
}

if (import.meta.main) {
  debugMondayCotoDiscount().catch(console.error);
}