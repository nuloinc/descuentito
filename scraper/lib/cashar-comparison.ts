import { logger } from "../trigger/lib/logger.js";

interface CasharDiscount {
  store: string;
  percentage: number;
  weekday: string;
  paymentMethod: string;
  source: string;
}

interface OurDiscount {
  store: string;
  percentage: number;
  weekday: string;
  paymentMethod: string;
  normalizedPaymentMethod?: string;
}

interface CasharComparisonResult {
  casharTotal: number;
  ourTotal: number;
  missing: number;
  extra: number;
  flexibleMatches: number;
  missingHighValue: CasharDiscount[];
  topMissing: CasharDiscount[];
}

// Enhanced payment method normalization for Cashar comparison
function enhancedNormalizePaymentMethod(method: string): string | null {
  const methodLower = method.toLowerCase().trim();
  
  // Handle compound payment methods like "Santa Fe credito + modo"
  if (methodLower.includes('+') || methodLower.includes('y ') || methodLower.includes(' con ')) {
    return normalizeCompoundPaymentMethod(methodLower);
  }
  
  // Specific product mappings (most granular)
  const specificMappings = {
    'tarjeta carrefour prepaga': 'carrefourpre',
    'tarjeta carrefour crédito': 'carrefourcred',
    'tarjeta carrefour credito': 'carrefourcred',
    'banco macro - tarjeta platinum': 'macroplatinum',
    'banco macro - tarjeta selecta': 'macroselecta',
    'tarjeta de crédito patagonia 365': 'patagonia365',
    'tarjeta de credito patagonia 365': 'patagonia365',
    'banco nación - tarjeta nativa': 'nativan',
    'banco nacion - tarjeta nativa': 'nativan',
    'banco ciudad - plan sueldo y jubilados': 'ciudadplan',
    'banco galicia - eminent': 'galiciaem',
    'banco santander - jubilados': 'santjub',
    'banco santander - women': 'santwomen',
    'sidecreer': 'sidecreer',
    // Santa Fe specific variations
    'banco santa fe credito': 'santafecred',
    'banco santa fe crédito': 'santafecred',
    'santa fe credito': 'santafecred',
    'santa fe crédito': 'santafecred',
    'banco santa fe debito': 'santafedebit',
    'banco santa fe débito': 'santafedebit',
    'santa fe debito': 'santafedebit',
    'santa fe débito': 'santafedebit'
  };
  
  // Check specific mappings first
  for (const [fullName, shortName] of Object.entries(specificMappings)) {
    if (methodLower.includes(fullName)) {
      return shortName;
    }
  }
  
  // Bank mappings with credit/debit detection
  const bankMappings = {
    'mercado pago': 'mp',
    'banco galicia': 'galicia',
    'banco ciudad': 'ciudad',
    'personal pay': 'ppay',
    'uala': 'uala',
    'banco patagonia': 'patagonia',
    'banco bbva': 'bbva',
    'banco nación': 'nacion',
    'banco nacion': 'nacion',
    'banco macro': 'macro',
    'banco santander': 'santander',
    'banco icbc': 'icbc',
    'banco credicoop': 'credicoop',
    'banco comafi': 'comafi',
    'banco supervielle': 'supervielle',
    'naranjax': 'naranja',
    'cuenta dni': 'dni',
    'banco santa fe': 'santafe',
    'santa fe': 'santafe',
    'prex': 'prex',
    'yoy': 'yoy'
  };
  
  // Rail mappings
  const railMappings = {
    'modo': 'modo',
    'tarjeta de crédito visa': 'visa',
    'tarjeta de credito visa': 'visa',
    'tarjeta de débito visa': 'visadebit',
    'tarjeta de debito visa': 'visadebit',
    'tarjeta de crédito mastercard': 'master',
    'tarjeta de credito mastercard': 'master',
    'tarjeta de débito mastercard': 'masterdebit',
    'tarjeta de debito mastercard': 'masterdebit',
    'tarjeta prepaga mastercard': 'masterprepaga',
    'tarjeta de crédito cabal': 'cabal',
    'tarjeta de credito cabal': 'cabal',
    'tarjeta american express': 'amex',
    'visa': 'visa',
    'mastercard': 'master',
    'cabal': 'cabal'
  };
  
  // Enhanced bank detection with credit/debit type
  for (const [fullName, shortName] of Object.entries(bankMappings)) {
    if (methodLower.includes(fullName)) {
      // Check for credit/debit type
      if (methodLower.includes('crédito') || methodLower.includes('credito')) {
        return shortName + 'cred';
      } else if (methodLower.includes('débito') || methodLower.includes('debito')) {
        return shortName + 'debit';
      }
      return shortName;
    }
  }
  
  // Check rail mappings
  for (const [fullName, shortName] of Object.entries(railMappings)) {
    if (methodLower.includes(fullName)) {
      return shortName;
    }
  }
  
  return null;
}

// Handle compound payment methods like "Santa Fe credito + modo"
function normalizeCompoundPaymentMethod(methodLower: string): string | null {
  const parts = methodLower.split(/\s*[\+y]\s*|\s+con\s+/);
  const normalizedParts: string[] = [];
  
  for (const part of parts) {
    const normalized = enhancedNormalizePaymentMethod(part.trim());
    if (normalized) {
      normalizedParts.push(normalized);
    }
  }
  
  if (normalizedParts.length > 1) {
    // Sort for consistent compound keys
    return normalizedParts.sort().join('+');
  } else if (normalizedParts.length === 1) {
    return normalizedParts[0];
  }
  
  return null;
}

// Create flexible matching variations for payment methods
function createPaymentMethodVariations(paymentMethod: string): string[] {
  const variations = new Set([paymentMethod]);
  const lower = paymentMethod.toLowerCase();
  
  // Add common variations
  variations.add(lower);
  variations.add(lower.replace(/\s+/g, ''));
  variations.add(lower.replace(/[áéíóú]/g, c => ({'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u'}[c])));
  
  // Handle compound methods
  if (lower.includes('+')) {
    const parts = lower.split('+');
    variations.add(parts.join(' y '));
    variations.add(parts.join(' con '));
    variations.add(parts.reverse().join('+'));
  }
  
  // Handle credit/debit variations
  if (lower.includes('credito')) {
    variations.add(lower.replace('credito', 'crédito'));
  }
  if (lower.includes('crédito')) {
    variations.add(lower.replace('crédito', 'credito'));
  }
  if (lower.includes('debito')) {
    variations.add(lower.replace('debito', 'débito'));
  }
  if (lower.includes('débito')) {
    variations.add(lower.replace('débito', 'debito'));
  }
  
  return Array.from(variations);
}

// Mock function - replace with actual Google Sheets fetching logic
async function fetchCasharData(): Promise<CasharDiscount[]> {
  // This should fetch from Google Sheets iframes on cashar.pro/cashback
  logger.info("Fetching Cashar.pro discount data...");
  
  // For now, return mock data that demonstrates the Santa Fe + modo issue
  return [
    {
      store: "coto",
      percentage: 30,
      weekday: "miércoles",
      paymentMethod: "Santa Fe credito + modo",
      source: "https://docs.google.com/spreadsheets/d/example1"
    },
    {
      store: "carrefour", 
      percentage: 25,
      weekday: "martes",
      paymentMethod: "Banco Santa Fe crédito con MODO",
      source: "https://docs.google.com/spreadsheets/d/example2"
    },
    {
      store: "jumbo",
      percentage: 20,
      weekday: "jueves", 
      paymentMethod: "MODO + Santa Fe débito",
      source: "https://docs.google.com/spreadsheets/d/example3"
    },
    {
      store: "dia",
      percentage: 15,
      weekday: "lunes",
      paymentMethod: "Mercado Pago",
      source: "https://docs.google.com/spreadsheets/d/example4"
    }
  ];
}

// Mock function - replace with actual discount fetching logic  
async function fetchOurDiscounts(): Promise<OurDiscount[]> {
  logger.info("Fetching our discount data...");
  
  // Mock data representing our current discounts
  return [
    {
      store: "dia",
      percentage: 15, 
      weekday: "lunes",
      paymentMethod: "Mercado Pago",
      normalizedPaymentMethod: "mp"
    },
    {
      store: "carrefour",
      percentage: 20,
      weekday: "viernes", 
      paymentMethod: "Banco Galicia",
      normalizedPaymentMethod: "galicia"
    }
  ];
}

// Generate discount key for comparison
function generateDiscountKey(discount: CasharDiscount | OurDiscount): string | null {
  const normalizedPayment = enhancedNormalizePaymentMethod(discount.paymentMethod);
  if (!normalizedPayment) return null;
  
  return `${discount.store}-${normalizedPayment}-${discount.weekday.toLowerCase()}`;
}

// Main comparison function
export async function runCasharComparison(): Promise<CasharComparisonResult> {
  try {
    logger.info("Starting Cashar.pro comparison with enhanced payment method detection...");
    
    const [casharDiscounts, ourDiscounts] = await Promise.all([
      fetchCasharData(),
      fetchOurDiscounts()
    ]);
    
    logger.info(`Loaded ${casharDiscounts.length} Cashar discounts and ${ourDiscounts.length} our discounts`);
    
    // Generate keys for both datasets
    const casharKeys = new Set();
    const casharKeyToDiscount = new Map();
    
    for (const discount of casharDiscounts) {
      const key = generateDiscountKey(discount);
      if (key) {
        casharKeys.add(key);
        casharKeyToDiscount.set(key, discount);
      }
    }
    
    const ourKeys = new Set();
    for (const discount of ourDiscounts) {
      const key = generateDiscountKey(discount);
      if (key) {
        ourKeys.add(key);
      }
    }
    
    // Find missing discounts (in Cashar but not in our data)
    const missingKeys = [...casharKeys].filter(key => !ourKeys.has(key));
    const missing = missingKeys.map(key => casharKeyToDiscount.get(key)).filter(Boolean);
    
    // Find high-value missing discounts (25%+)
    const missingHighValue = missing.filter(d => d.percentage >= 25);
    
    // Sort by percentage descending
    const topMissing = missing
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 10);
    
    // Calculate flexible matches (approximate matching)
    const flexibleMatches = casharKeys.size - missingKeys.length;
    
    const result = {
      casharTotal: casharDiscounts.length,
      ourTotal: ourDiscounts.length,
      missing: missing.length,
      extra: ourKeys.size - flexibleMatches,
      flexibleMatches,
      missingHighValue,
      topMissing
    };
    
    // Log payment method detection analysis
    logger.info("Payment method detection analysis:");
    const uniquePaymentMethods = [...new Set(casharDiscounts.map(d => d.paymentMethod))];
    for (const method of uniquePaymentMethods) {
      const normalized = enhancedNormalizePaymentMethod(method);
      logger.info(`  "${method}" → "${normalized}"`);
    }
    
    return result;
    
  } catch (error) {
    logger.error("Error in Cashar comparison:", error);
    throw error;
  }
}