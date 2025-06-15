#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { generateDiscountKey } from './lib/discount-keys/discount-keys.js';

interface CasharDiscount {
  store?: string;
  discount?: string;
  paymentMethod?: string;
  day?: string;
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

function normalizeStoreName(store: string): string {
  return store.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/online|express|maxi|\+/g, '')
    .replace(/[áàâã]/g, 'a')
    .replace(/[éèê]/g, 'e')
    .replace(/[íìî]/g, 'i')
    .replace(/[óòôõ]/g, 'o')
    .replace(/[úùû]/g, 'u');
}

function extractDiscountValue(discountStr: string): number | null {
  const match = discountStr.match(/(\d+)%/);
  return match ? parseInt(match[1]) : null;
}

function compareCarrefour() {
  console.log('🔍 DETAILED CARREFOUR COMPARISON\n');
  
  // Load cashar data
  const casharData: CasharDiscount[] = JSON.parse(
    readFileSync('cashar-raw-data.json', 'utf-8')
  );
  
  // Load our Carrefour data
  const ourData: OurDiscount[] = JSON.parse(
    readFileSync('../../descuentito-data/carrefour.json', 'utf-8')
  );
  
  // Add source to our data
  ourData.forEach(d => d.source = 'carrefour');
  
  // Filter cashar data for Carrefour
  const casharCarrefour = casharData.filter(d => {
    if (!d.store) return false;
    const normalized = normalizeStoreName(d.store);
    return normalized.includes('carrefour');
  });
  
  console.log('📊 RAW DATA COMPARISON:');
  console.log(`Cashar Carrefour entries: ${casharCarrefour.length}`);
  console.log(`Our Carrefour entries: ${ourData.length}\n`);
  
  // Show raw cashar data
  console.log('🛒 CASHAR CARREFOUR DATA:');
  casharCarrefour.forEach((item, i) => {
    console.log(`${i + 1}. Store: "${item.store}"`);
    console.log(`   Discount: "${item.discount || 'N/A'}"`);
    console.log(`   Payment: "${item.paymentMethod || 'N/A'}"`);
    console.log(`   Day: "${item.day || 'N/A'}"`);
    console.log();
  });
  
  // Show sample of our data
  console.log('🏪 OUR CARREFOUR DATA (first 5):');
  ourData.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}. Discount: ${item.discount.value}% (${item.discount.type})`);
    console.log(`   Payment Methods: ${item.paymentMethods ? item.paymentMethods.map(pm => pm.join(' + ')).join(' | ') : 'N/A'}`);
    console.log(`   Valid: ${item.validFrom} to ${item.validUntil}`);
    console.log(`   Weekdays: ${item.weekdays ? item.weekdays.join(', ') : 'N/A'}`);
    console.log(`   Restrictions: ${item.restrictions ? item.restrictions.slice(0, 2).join('; ') : 'None'}`);
    console.log();
  });
  
  // Generate keys for comparison
  console.log('🔑 KEY GENERATION COMPARISON:');
  
  // Convert cashar to our format for key generation
  const casharConverted = casharCarrefour
    .map(c => {
      const discountValue = extractDiscountValue(c.discount || '');
      if (!discountValue) return null;
      
      const converted: OurDiscount = {
        source: 'carrefour',
        discount: {
          type: 'porcentaje',
          value: discountValue
        },
        validFrom: '2025-06-01',
        validUntil: '2025-06-30',
        paymentMethods: c.paymentMethod ? [[c.paymentMethod]] : [['Any']],
        restrictions: []
      };
      return converted;
    })
    .filter((d): d is OurDiscount => d !== null);
  
  console.log('\n🔑 CASHAR KEYS (converted):');
  casharConverted.forEach((item, i) => {
    const key = generateDiscountKey(item);
    console.log(`${i + 1}. ${key}`);
    console.log(`   Original: "${casharCarrefour[i].store}" - "${casharCarrefour[i].discount}" - "${casharCarrefour[i].paymentMethod || 'Any'}"`);
    console.log();
  });
  
  console.log('🔑 OUR KEYS (first 5):');
  ourData.slice(0, 5).forEach((item, i) => {
    const key = generateDiscountKey(item);
    console.log(`${i + 1}. ${key}`);
    console.log(`   Original: ${item.discount.value}% - ${item.paymentMethods ? item.paymentMethods.map(pm => pm.join(' + ')).join(' | ') : 'Any'}`);
    console.log();
  });
  
  // Simple percentage-based comparison
  console.log('📈 SIMPLE PERCENTAGE COMPARISON:');
  
  const casharPercentages = new Set(
    casharCarrefour
      .map(c => extractDiscountValue(c.discount || ''))
      .filter((v): v is number => v !== null)
  );
  
  const ourPercentages = new Set(
    ourData.map(d => d.discount.value)
  );
  
  console.log('Cashar percentages:', Array.from(casharPercentages).sort((a, b) => b - a));
  console.log('Our percentages:', Array.from(ourPercentages).sort((a, b) => b - a));
  
  const missingPercentages = Array.from(casharPercentages).filter(p => !ourPercentages.has(p));
  const extraPercentages = Array.from(ourPercentages).filter(p => !casharPercentages.has(p));
  
  console.log('\n❌ Missing percentages:', missingPercentages.sort((a, b) => b - a));
  console.log('✅ Extra percentages:', extraPercentages.sort((a, b) => b - a));
  
  // Detailed analysis by percentage
  console.log('\n🔍 DETAILED BREAKDOWN BY PERCENTAGE:');
  
  const allPercentages = new Set([...casharPercentages, ...ourPercentages]);
  for (const percentage of Array.from(allPercentages).sort((a, b) => b - a)) {
    console.log(`\n📊 ${percentage}% DISCOUNTS:`);
    
    const casharWithThisPercentage = casharCarrefour.filter(c => 
      extractDiscountValue(c.discount || '') === percentage
    );
    const ourWithThisPercentage = ourData.filter(d => d.discount.value === percentage);
    
    console.log(`   Cashar: ${casharWithThisPercentage.length} entries`);
    casharWithThisPercentage.forEach(c => {
      console.log(`      • "${c.store}" - "${c.paymentMethod || 'Any payment'}"`);
    });
    
    console.log(`   Ours: ${ourWithThisPercentage.length} entries`);
    ourWithThisPercentage.slice(0, 3).forEach(o => {
      const payments = o.paymentMethods ? o.paymentMethods.map(pm => pm.join(' + ')).join(' | ') : 'Any';
      console.log(`      • ${payments} (${o.weekdays ? o.weekdays.join(',') : 'All days'})`);
    });
    if (ourWithThisPercentage.length > 3) {
      console.log(`      ... and ${ourWithThisPercentage.length - 3} more`);
    }
  }
  
  return {
    casharEntries: casharCarrefour.length,
    ourEntries: ourData.length,
    casharPercentages: Array.from(casharPercentages),
    ourPercentages: Array.from(ourPercentages),
    missingPercentages,
    extraPercentages
  };
}

if (import.meta.main) {
  compareCarrefour();
}