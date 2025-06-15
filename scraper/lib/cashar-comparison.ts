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

interface ComparisonResult {
  casharTotal: number;
  ourTotal: number;
  missing: number;
  extra: number;
  flexibleMatches: number;
  missingHighValue: Array<{
    store: string;
    percentage: number;
    weekday: string;
    paymentMethod: string;
    source: string;
  }>;
  topMissing: Array<{
    store: string;
    percentage: number;
    weekday: string;
    paymentMethod: string;
    source: string;
  }>;
}

// Google Sheets URLs with their GIDs to determine weekdays
const CASHAR_SHEETS_WITH_DAYS = [
  { gid: '347859634', day: 'Monday' },
  { gid: '1181745328', day: 'Tuesday' },
  { gid: '341746925', day: 'Wednesday' },
  { gid: '620812173', day: 'Thursday' },
  { gid: '973607635', day: 'Friday' },
  { gid: '1547716557', day: 'Saturday' },
  { gid: '2002645581', day: 'Sunday' }
];

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
  const normalized = payment.toLowerCase()
    .replace(/\s+/g, '')
    .replace(/🔥/g, '')
    .replace(/tarjeta/g, '')
    .replace(/card/g, '')
    .replace(/credito|crédito/g, 'cred')
    .replace(/debito|débito/g, 'deb')
    .replace(/banco/g, '')
    .replace(/de/g, '');
  
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

function extractDiscountValue(discountStr: string): number | null {
  const match = discountStr.match(/(\d+)%/);
  return match ? parseInt(match[1]) : null;
}

async function fetchSheetsByDay(): Promise<Record<string, CasharDiscount[]>> {
  const dataByDay: Record<string, CasharDiscount[]> = {};
  
  for (const sheet of CASHAR_SHEETS_WITH_DAYS) {
    const url = `https://docs.google.com/spreadsheets/d/e/2PACX-1vTARZt6d9-so9FfY8w0a8mE454Ygegw1GwfdfeX2KqdTU11SCaV2Es-jmGNjspBcDO7VCdKUCvwvh4z/pubhtml?gid=${sheet.gid}&single=true`;
    
    try {
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
              .replace(/<[^>]*>/g, '')
              .replace(/&nbsp;/g, ' ')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .trim();
            cells.push(cellText);
          }
          cellRegex.lastIndex = 0;

          if (cells.length >= 3 && cells.some(cell => cell.includes('%'))) {
            // Parse structured table: [index, store, payment_method, discount%, ...]
            const discount: Partial<CasharDiscount> = {
              source: 'cashar.pro' as const,
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
               cell.includes('Crédito') || cell.includes('Débito') || cell.includes('QR'))
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
      
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error(`Error fetching ${sheet.day}:`, error);
      dataByDay[sheet.day] = [];
    }
  }
  
  return dataByDay;
}

function structureCasharData(dataByDay: Record<string, CasharDiscount[]>): StructuredDiscount[] {
  const structured: StructuredDiscount[] = [];
  
  for (const [day, discounts] of Object.entries(dataByDay)) {
    for (const discount of discounts) {
      const percentage = extractDiscountValue(discount.discount || '');
      if (!percentage || !discount.store) continue;
      
      const normalizedStore = normalizeStoreName(discount.store);
      
      // Filter for our tracked supermarkets
      const trackedStores = ['carrefour', 'coto', 'dia', 'jumbo', 'changomas', 'makro'];
      const matchingStore = trackedStores.find(store => 
        normalizedStore.includes(store) || discount.store!.toLowerCase().includes(store)
      );
      
      if (matchingStore) {
        structured.push({
          store: matchingStore,
          percentage,
          paymentMethod: normalizePaymentMethod(discount.paymentMethod || 'any'),
          weekday: normalizeWeekday(day),
          restrictions: discount.conditions,
          source: 'cashar',
          originalData: discount
        });
      }
    }
  }
  
  return structured;
}

function structureOurData(): StructuredDiscount[] {
  const structured: StructuredDiscount[] = [];
  const stores = ['carrefour', 'coto', 'dia', 'jumbo', 'changomas', 'makro'];
  
  for (const store of stores) {
    try {
      const data: OurDiscount[] = JSON.parse(
        readFileSync(`../../descuentito-data/${store}.json`, 'utf-8')
      );
      
      for (const discount of data) {
        const weekdays = discount.weekdays || ['all'];
        const paymentMethods = discount.paymentMethods || [['any']];
        
        // Create entry for each weekday and payment method combination
        for (const weekday of weekdays) {
          for (const paymentMethodGroup of paymentMethods) {
            const paymentMethod = paymentMethodGroup.join('+');
            
            structured.push({
              store,
              percentage: discount.discount.value,
              paymentMethod: normalizePaymentMethod(paymentMethod),
              weekday: normalizeWeekday(weekday),
              restrictions: discount.restrictions?.join('; '),
              source: 'our',
              originalData: discount
            });
          }
        }
      }
    } catch (error) {
      // Store file doesn't exist or can't be read
      console.log(`Could not load ${store}.json`);
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

export async function runCasharComparison(): Promise<ComparisonResult> {
  // Fetch cashar data organized by weekday
  const casharByDay = await fetchSheetsByDay();
  
  // Structure the data properly
  const casharStructured = structureCasharData(casharByDay);
  const ourStructured = structureOurData();
  
  // Create sets of comparison keys
  const casharKeys = new Set(casharStructured.map(createComparisonKey));
  const ourKeys = new Set(ourStructured.map(createComparisonKey));
  
  // Find missing and extra (exact match)
  const missingFromUs = casharStructured.filter(c => !ourKeys.has(createComparisonKey(c)));
  
  // Also do flexible comparison (ignoring weekdays)
  const casharFlexibleKeys = new Set(casharStructured.map(createFlexibleComparisonKey));
  const ourFlexibleKeys = new Set(ourStructured.map(createFlexibleComparisonKey));
  
  const missingFlexible = casharStructured.filter(c => !ourFlexibleKeys.has(createFlexibleComparisonKey(c)));
  const matchedFlexible = casharStructured.filter(c => ourFlexibleKeys.has(createFlexibleComparisonKey(c)));
  
  // Find high-value missing opportunities (25%+ discounts)
  const missingHighValue = missingFromUs
    .filter(m => m.percentage >= 25)
    .map(m => {
      const original = m.originalData as CasharDiscount;
      return {
        store: m.store,
        percentage: m.percentage,
        weekday: m.weekday,
        paymentMethod: m.paymentMethod,
        source: original.store || 'Unknown'
      };
    });
  
  // Get top 10 missing opportunities sorted by percentage
  const topMissing = missingFromUs
    .sort((a, b) => b.percentage - a.percentage)
    .slice(0, 10)
    .map(m => {
      const original = m.originalData as CasharDiscount;
      return {
        store: m.store,
        percentage: m.percentage,
        weekday: m.weekday,
        paymentMethod: m.paymentMethod,
        source: original.store || 'Unknown'
      };
    });
  
  return {
    casharTotal: casharStructured.length,
    ourTotal: ourStructured.length,
    missing: missingFromUs.length,
    extra: ourStructured.length - casharStructured.length,
    flexibleMatches: matchedFlexible.length,
    missingHighValue,
    topMissing
  };
}