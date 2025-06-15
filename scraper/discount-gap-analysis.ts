#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { generateDiscountKey, generateUniqueDiscountKeys } from './lib/discount-keys/discount-keys.js';

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

interface NormalizedDiscount {
  source: string;
  discountType: string;
  discountValue: number;
  paymentMethods: string[];
  originalData: CasharDiscount | OurDiscount;
}

// Our supermarkets that we want to compare
const OUR_SUPERMARKETS = ['carrefour', 'coto', 'dia', 'jumbo', 'changomas', 'makro'];

function normalizeStoreName(store: string): string {
  return store.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[áàâã]/g, 'a')
    .replace(/[éèê]/g, 'e')
    .replace(/[íìî]/g, 'i')
    .replace(/[óòôõ]/g, 'o')
    .replace(/[úùû]/g, 'u')
    .replace(/online|express|maxi|\+/g, '');
}

function extractDiscountValue(discountStr: string): number | null {
  const match = discountStr.match(/(\d+)%/);
  return match ? parseInt(match[1]) : null;
}

function normalizeCasharDiscount(cashar: CasharDiscount): NormalizedDiscount | null {
  if (!cashar.store || !cashar.discount) return null;
  
  const normalizedStore = normalizeStoreName(cashar.store);
  const discountValue = extractDiscountValue(cashar.discount);
  
  if (!discountValue) return null;
  
  // Check if this store matches any of our supermarkets
  const matchingStore = OUR_SUPERMARKETS.find(ourStore => 
    normalizedStore.includes(ourStore) || ourStore.includes(normalizedStore)
  );
  
  if (!matchingStore) return null;
  
  return {
    source: matchingStore,
    discountType: 'porcentaje',
    discountValue,
    paymentMethods: cashar.paymentMethod ? [cashar.paymentMethod] : [],
    originalData: cashar
  };
}

function normalizeOurDiscount(discount: OurDiscount): NormalizedDiscount {
  return {
    source: normalizeStoreName(discount.source),
    discountType: discount.discount.type,
    discountValue: discount.discount.value,
    paymentMethods: discount.paymentMethods ? discount.paymentMethods.flat() : [],
    originalData: discount
  };
}

function createComparableKey(normalized: NormalizedDiscount): string {
  // Create a simplified key for comparison
  const paymentKey = normalized.paymentMethods
    .map(pm => pm.toLowerCase().replace(/\s+/g, ''))
    .sort()
    .join(',');
  
  return `${normalized.source}-${normalized.discountType}-${normalized.discountValue}-${paymentKey}`;
}

function analyzeDiscountGaps(casharDiscounts: CasharDiscount[], ourDiscounts: OurDiscount[]) {
  console.log('🔍 ANALYZING DISCOUNT GAPS FOR EXISTING SUPERMARKETS\n');
  
  // Normalize both datasets
  const normalizedCashar = casharDiscounts
    .map(normalizeCasharDiscount)
    .filter((d): d is NormalizedDiscount => d !== null);
  
  const normalizedOur = ourDiscounts.map(normalizeOurDiscount);
  
  console.log(`📊 Data Summary:`);
  console.log(`   Cashar discounts (for our stores): ${normalizedCashar.length}`);
  console.log(`   Our discounts: ${normalizedOur.length}\n`);
  
  // Group by store
  const casharByStore = normalizedCashar.reduce((acc, d) => {
    if (!acc[d.source]) acc[d.source] = [];
    acc[d.source].push(d);
    return acc;
  }, {} as Record<string, NormalizedDiscount[]>);
  
  const ourByStore = normalizedOur.reduce((acc, d) => {
    if (!acc[d.source]) acc[d.source] = [];
    acc[d.source].push(d);
    return acc;
  }, {} as Record<string, NormalizedDiscount[]>);
  
  // Create comparable keys
  const casharKeys = new Set(normalizedCashar.map(createComparableKey));
  const ourKeys = new Set(normalizedOur.map(createComparableKey));
  
  console.log('🏪 STORE-BY-STORE ANALYSIS:\n');
  
  const missingDiscounts: Array<{
    store: string;
    casharDiscount: NormalizedDiscount;
    reason: string;
  }> = [];
  
  for (const store of OUR_SUPERMARKETS) {
    const casharForStore = casharByStore[store] || [];
    const ourForStore = ourByStore[store] || [];
    
    console.log(`📋 ${store.toUpperCase()}:`);
    console.log(`   Cashar: ${casharForStore.length} discounts`);
    console.log(`   Ours: ${ourForStore.length} discounts`);
    
    if (casharForStore.length === 0) {
      console.log(`   ✅ No additional discounts found in Cashar\n`);
      continue;
    }
    
    // Find missing discounts
    const missing = casharForStore.filter(casharDiscount => {
      const casharKey = createComparableKey(casharDiscount);
      return !ourKeys.has(casharKey);
    });
    
    if (missing.length === 0) {
      console.log(`   ✅ All Cashar discounts covered\n`);
    } else {
      console.log(`   ❌ Missing ${missing.length} discount(s):`);
      missing.forEach(m => {
        const original = m.originalData as CasharDiscount;
        console.log(`      • ${m.discountValue}% - ${m.paymentMethods.join(', ') || 'Any payment'}`);
        console.log(`        Original: "${original.store}" - "${original.discount}"`);
        missingDiscounts.push({
          store,
          casharDiscount: m,
          reason: 'Not found in our system'
        });
      });
      console.log();
    }
  }
  
  console.log('📈 SUMMARY:\n');
  console.log(`Total missing opportunities: ${missingDiscounts.length}`);
  
  if (missingDiscounts.length > 0) {
    console.log('\n🎯 PRIORITIZED MISSING DISCOUNTS:');
    
    // Group by discount value (higher discounts first)
    const byValue = missingDiscounts.sort((a, b) => 
      b.casharDiscount.discountValue - a.casharDiscount.discountValue
    );
    
    byValue.forEach((missing, i) => {
      const original = missing.casharDiscount.originalData as CasharDiscount;
      console.log(`${i + 1}. ${missing.store.toUpperCase()} - ${missing.casharDiscount.discountValue}%`);
      console.log(`   Payment: ${missing.casharDiscount.paymentMethods.join(', ') || 'Any'}`);
      console.log(`   Source: "${original.store}" - "${original.discount}"`);
      if (original.paymentMethod) console.log(`   Payment Method: "${original.paymentMethod}"`);
      console.log();
    });
  } else {
    console.log('✅ No missing discount opportunities found!');
    console.log('Our system appears to have comprehensive coverage for all tracked supermarkets.');
  }
  
  return {
    totalMissing: missingDiscounts.length,
    missingByStore: missingDiscounts.reduce((acc, m) => {
      if (!acc[m.store]) acc[m.store] = [];
      acc[m.store].push(m);
      return acc;
    }, {} as Record<string, typeof missingDiscounts>),
    casharCoverage: Object.keys(casharByStore).length,
    ourCoverage: Object.keys(ourByStore).length
  };
}

async function main() {
  try {
    // Load cashar data
    const casharData: CasharDiscount[] = JSON.parse(
      readFileSync('cashar-raw-data.json', 'utf-8')
    );
    
    // Load our discount data
    const ourData: OurDiscount[] = JSON.parse(
      readFileSync('../../descuentito-data/carrefour.json', 'utf-8')
    ).concat(
      JSON.parse(readFileSync('../../descuentito-data/coto.json', 'utf-8')),
      JSON.parse(readFileSync('../../descuentito-data/dia.json', 'utf-8')),
      JSON.parse(readFileSync('../../descuentito-data/jumbo.json', 'utf-8')),
      JSON.parse(readFileSync('../../descuentito-data/changomas.json', 'utf-8')),
      JSON.parse(readFileSync('../../descuentito-data/makro.json', 'utf-8'))
    );
    
    // Add source to our data
    const allOurData = ourData.map((discount, index) => {
      if (!discount.source) {
        // Determine source from file order
        const totalPerFile = ourData.length / 6;
        const fileIndex = Math.floor(index / totalPerFile);
        discount.source = OUR_SUPERMARKETS[fileIndex] || 'unknown';
      }
      return discount;
    });
    
    // Re-read with proper sources
    const properOurData: OurDiscount[] = [];
    for (const store of OUR_SUPERMARKETS) {
      try {
        const storeData = JSON.parse(
          readFileSync(`../../descuentito-data/${store}.json`, 'utf-8')
        ) as OurDiscount[];
        storeData.forEach(d => d.source = store);
        properOurData.push(...storeData);
      } catch (error) {
        console.log(`⚠️  Could not load ${store}.json`);
      }
    }
    
    const analysis = analyzeDiscountGaps(casharData, properOurData);
    
    // Save detailed analysis
    const report = {
      timestamp: new Date().toISOString(),
      analysis,
      recommendations: analysis.totalMissing > 0 ? [
        'Review the missing discounts above',
        'Verify if these are actual gaps or parsing differences',
        'Consider updating scrapers to capture missed promotions'
      ] : [
        'Excellent coverage! No gaps detected.',
        'Continue monitoring for new promotional patterns'
      ]
    };
    
    require('fs').writeFileSync('discount-gap-analysis.json', JSON.stringify(report, null, 2));
    console.log('\n💾 Detailed analysis saved to discount-gap-analysis.json');
    
  } catch (error) {
    console.error('❌ Error during analysis:', error);
  }
}

if (import.meta.main) {
  main();
}