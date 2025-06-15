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
  source: 'cashar' | 'our';
  originalData: CasharDiscount | OurDiscount;
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

function normalizePaymentMethod(payment: string): string {
  return payment.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/🔥/g, '')
    .replace(/tarjeta|card/g, '')
    .replace(/credito|crédito/g, 'cred')
    .replace(/debito|débito/g, 'deb')
    .replace(/mastercard/g, 'master')
    .replace(/banco/g, '');
}

function normalizeWeekday(day: string): string {
  const dayMap: Record<string, string> = {
    'monday': 'lunes',
    'tuesday': 'martes', 
    'wednesday': 'miercoles',
    'thursday': 'jueves',
    'friday': 'viernes',
    'saturday': 'sabado',
    'sunday': 'domingo',
    'lunes': 'lunes',
    'martes': 'martes',
    'miercoles': 'miercoles',
    'jueves': 'jueves',
    'viernes': 'viernes',
    'sabado': 'sabado',
    'domingo': 'domingo'
  };
  return dayMap[day.toLowerCase()] || day.toLowerCase();
}

function createComparisonKey(discount: StructuredDiscount): string {
  return `${discount.store}-${discount.percentage}%-${discount.weekday}-${discount.paymentMethod}`;
}

function debugSpecificCase() {
  console.log('🔍 DEBUGGING CARREFOUR 15% MASTERCARD MONDAY CASE\n');
  
  // Load cashar raw data
  const casharData: CasharDiscount[] = JSON.parse(
    readFileSync('cashar-raw-data.json', 'utf-8')
  );
  
  // Load our Carrefour data
  const ourData: OurDiscount[] = JSON.parse(
    readFileSync('../../descuentito-data/carrefour.json', 'utf-8')
  );
  
  // Find the specific Cashar entry
  const casharExpress = casharData.find(d => 
    d.store?.toLowerCase().includes('carrefour express') && 
    d.discount?.includes('15%') &&
    d.paymentMethod?.toLowerCase().includes('mastercard')
  );
  
  console.log('🛒 CASHAR CARREFOUR EXPRESS ENTRY:');
  if (casharExpress) {
    console.log(`Store: "${casharExpress.store}"`);
    console.log(`Discount: "${casharExpress.discount}"`);
    console.log(`Payment: "${casharExpress.paymentMethod}"`);
    console.log(`Day: "${casharExpress.day}"`);
    
    // Normalize this entry
    const casharNormalized = {
      store: normalizeStoreName(casharExpress.store || ''),
      percentage: 15,
      paymentMethod: normalizePaymentMethod(casharExpress.paymentMethod || ''),
      weekday: normalizeWeekday('Monday'),
      source: 'cashar' as const,
      originalData: casharExpress
    };
    
    console.log('\n🔧 CASHAR NORMALIZED:');
    console.log(`Store: "${casharNormalized.store}"`);
    console.log(`Percentage: ${casharNormalized.percentage}%`);
    console.log(`Payment: "${casharNormalized.paymentMethod}"`);
    console.log(`Weekday: "${casharNormalized.weekday}"`);
    
    const casharKey = createComparisonKey(casharNormalized);
    console.log(`Key: "${casharKey}"`);
  } else {
    console.log('❌ Carrefour Express 15% Mastercard entry not found in Cashar data!');
  }
  
  // Find matching entries in our data
  console.log('\n🏪 OUR CARREFOUR 15% ENTRIES:');
  const our15Percent = ourData.filter(d => d.discount.value === 15);
  
  console.log(`Found ${our15Percent.length} entries with 15% discount:`);
  our15Percent.forEach((discount, i) => {
    console.log(`\n${i + 1}. Original data:`);
    console.log(`   Discount: ${discount.discount.value}% (${discount.discount.type})`);
    console.log(`   Payment Methods: ${discount.paymentMethods?.map(pm => pm.join(' + ')).join(' | ') || 'N/A'}`);
    console.log(`   Weekdays: ${discount.weekdays?.join(', ') || 'N/A'}`);
    
    // Check each weekday and payment method combination
    const weekdays = discount.weekdays || ['all'];
    const paymentMethods = discount.paymentMethods || [['any']];
    
    for (const weekday of weekdays) {
      for (const paymentMethodGroup of paymentMethods) {
        const paymentMethod = paymentMethodGroup.join('+');
        
        const ourNormalized = {
          store: 'carrefour',
          percentage: discount.discount.value,
          paymentMethod: normalizePaymentMethod(paymentMethod),
          weekday: normalizeWeekday(weekday),
          source: 'our' as const,
          originalData: discount
        };
        
        const ourKey = createComparisonKey(ourNormalized);
        console.log(`   Combination: ${ourNormalized.percentage}% on ${ourNormalized.weekday} with ${ourNormalized.paymentMethod}`);
        console.log(`   Key: "${ourKey}"`);
        
        // Check if this matches Mastercard Monday
        if (ourNormalized.weekday === 'lunes' && ourNormalized.paymentMethod.includes('master')) {
          console.log(`   🎯 POTENTIAL MATCH FOR MONDAY MASTERCARD!`);
        }
      }
    }
  });
  
  // Compare keys directly
  console.log('\n🔑 KEY COMPARISON:');
  if (casharExpress) {
    const casharKey = `carrefour-15%-lunes-master`;
    console.log(`Expected Cashar key: "${casharKey}"`);
    
    // Find exact matches in our data
    const matches = [];
    for (const discount of our15Percent) {
      const weekdays = discount.weekdays || ['all'];
      const paymentMethods = discount.paymentMethods || [['any']];
      
      for (const weekday of weekdays) {
        for (const paymentMethodGroup of paymentMethods) {
          const paymentMethod = paymentMethodGroup.join('+');
          const ourKey = createComparisonKey({
            store: 'carrefour',
            percentage: 15,
            paymentMethod: normalizePaymentMethod(paymentMethod),
            weekday: normalizeWeekday(weekday),
            source: 'our',
            originalData: discount
          });
          
          if (ourKey === casharKey) {
            matches.push({ discount, weekday, paymentMethod, key: ourKey });
          }
        }
      }
    }
    
    console.log(`\nMatches found: ${matches.length}`);
    matches.forEach((match, i) => {
      console.log(`${i + 1}. ${match.key}`);
      console.log(`   Original: ${match.paymentMethod} on ${match.weekday}`);
    });
    
    if (matches.length === 0) {
      console.log('\n❌ NO EXACT MATCHES FOUND');
      console.log('Let\'s check why...');
      
      // Check all our Monday entries
      console.log('\n📅 ALL OUR MONDAY ENTRIES:');
      let mondayCount = 0;
      for (const discount of ourData) {
        const weekdays = discount.weekdays || ['all'];
        if (weekdays.includes('Lunes') || weekdays.includes('lunes')) {
          mondayCount++;
          console.log(`${mondayCount}. ${discount.discount.value}% - ${discount.paymentMethods?.map(pm => pm.join(' + ')).join(' | ')}`);
        }
      }
      
      // Check all our Mastercard entries
      console.log('\n💳 ALL OUR MASTERCARD ENTRIES:');
      let mastercardCount = 0;
      for (const discount of ourData) {
        const paymentMethods = discount.paymentMethods || [['any']];
        const hasMastercard = paymentMethods.some(pm => 
          pm.some(p => p.toLowerCase().includes('mastercard'))
        );
        if (hasMastercard) {
          mastercardCount++;
          console.log(`${mastercardCount}. ${discount.discount.value}% on ${discount.weekdays?.join(',')} - ${discount.paymentMethods?.map(pm => pm.join(' + ')).join(' | ')}`);
        }
      }
    }
  }
}

if (import.meta.main) {
  debugSpecificCase();
}