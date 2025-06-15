import { describe, it, expect } from "vitest";
import { generateDiscountKey, validateDiscountKey } from "../lib/discount-keys";
import type { Discount } from "promos-db/schema";

// Sample data based on actual scraped discounts
const sampleDiscounts: Discount[] = [
  {
    source: "carrefour",
    discount: { type: "porcentaje", value: 15 },
    validFrom: "2025-06-01",
    validUntil: "2025-06-30",
    weekdays: ["Jueves"],
    restrictions: [
      "No válido para compras en cuotas.",
      "No acumulable con otras promociones vigentes.",
      "No válido para productos entregados ni vendidos por el fabricante.",
      "No válido para pagos con 2 (dos) tarjetas.",
      "No es acumulable con cupones de ticket más bajo."
    ],
    excludesProducts: "Bodegas Chandon, Leoncio Arizu, Terraza de los Andes, Trumpeter, La Rural, Rutini Wines, Bodega 33 Sur, Catena Zapata y Grupo Clos de los 7, Productos de la canasta de Precios Cuidados, Leches infantiles y maternizadas etapa 1 y 2, Electrodomésticos, Celulares, Productos de carnicería: carne vacuna, pollo, cerdo y embutidos ni conservadoras de cerveza.",
    paymentMethods: [["Banco Galicia", "Tarjeta de crédito VISA"]],
    unknownPaymentMethods: [],
    url: "https://example.com",
    where: ["Carrefour"],
    limits: { explicitlyHasNoLimit: false }
  },
  {
    source: "dia",
    discount: { type: "porcentaje", value: 25 },
    validFrom: "2025-04-01",
    validUntil: "2025-05-31",
    weekdays: ["Martes"],
    restrictions: ["No aplica para compras realizadas con Naranja VISA, Naranja Mastercard, Naranja AMEX, ni para transacciones realizadas en agrupadores y billeteras virtuales."],
    paymentMethods: [["NaranjaX"]],
    unknownPaymentMethods: [],
    url: "https://example.com",
    where: ["Dia"],
    limits: { explicitlyHasNoLimit: false }
  },
  {
    source: "coto",
    discount: { type: "porcentaje", value: 15 },
    validFrom: "2025-04-26",
    validUntil: "2025-04-27",
    restrictions: [],
    paymentMethods: [["Mercado Pago"]],
    unknownPaymentMethods: [],
    url: "https://example.com",
    where: ["Coto"],
    limits: { explicitlyHasNoLimit: true }
  },
  {
    source: "coto",
    discount: { type: "porcentaje", value: 20 },
    validFrom: "2025-04-26",
    validUntil: "2025-04-27",
    restrictions: [],
    paymentMethods: [["Banco Ciudad"]],
    unknownPaymentMethods: [],
    url: "https://example.com",
    where: ["Coto"],
    limits: { explicitlyHasNoLimit: false }
  },
  {
    source: "coto",
    discount: { type: "cuotas sin intereses", value: 18 },
    validFrom: "2025-04-01",
    validUntil: "2025-04-30",
    weekdays: ["Sabado", "Domingo"],
    restrictions: [],
    paymentMethods: [["Banco Ciudad", "Tarjeta de crédito VISA"]],
    unknownPaymentMethods: [],
    url: "https://example.com",
    where: ["Coto"],
    limits: { explicitlyHasNoLimit: false }
  },
  {
    source: "jumbo",
    discount: { type: "cuotas sin intereses", value: 12 },
    validFrom: "2025-06-01",
    validUntil: "2025-06-30",
    restrictions: [],
    paymentMethods: [["Banco Galicia", "Tarjeta de crédito VISA"], ["Banco Galicia", "Tarjeta de crédito Mastercard"]],
    unknownPaymentMethods: [],
    url: "https://example.com",
    where: ["Jumbo"],
    limits: { explicitlyHasNoLimit: false }
  },
  {
    source: "makro",
    discount: { type: "porcentaje", value: 10 },
    validFrom: "2025-06-01",
    validUntil: "2025-06-30",
    restrictions: [],
    paymentMethods: [],
    unknownPaymentMethods: [],
    url: "https://example.com",
    where: ["Makro"],
    limits: { explicitlyHasNoLimit: false }
  },
  {
    source: "changomas",
    discount: { type: "porcentaje", value: 20 },
    validFrom: "2025-04-01",
    validUntil: "2025-04-30",
    weekdays: ["Lunes"],
    restrictions: [],
    paymentMethods: [["Banco Santander"]],
    unknownPaymentMethods: [],
    url: "https://example.com",
    where: ["ChangoMas"],
    limits: { maxDiscount: 5000, explicitlyHasNoLimit: false }
  }
];

describe("sample data key generation", () => {
  it("should generate unique keys for all sample discounts", () => {
    const keys = sampleDiscounts.map(generateDiscountKey);
    const uniqueKeys = new Set(keys);
    
    // All keys should be unique
    expect(uniqueKeys.size).toBe(sampleDiscounts.length);
    
    // Log the keys for manual inspection
    console.log("\nGenerated keys:");
    keys.forEach((key, index) => {
      console.log(`${index + 1}. ${key}`);
    });
  });

  it("should generate valid keys for all sample discounts", () => {
    const keys = sampleDiscounts.map(generateDiscountKey);
    
    keys.forEach((key, index) => {
      expect(validateDiscountKey(key), `Key ${index + 1} should be valid: ${key}`).toBe(true);
    });
  });

  it("should generate deterministic keys", () => {
    // Generate keys twice for the same discounts
    const keys1 = sampleDiscounts.map(generateDiscountKey);
    const keys2 = sampleDiscounts.map(generateDiscountKey);
    
    expect(keys1).toEqual(keys2);
  });

  it("should differentiate similar discounts properly", () => {
    const cotoDiscounts = sampleDiscounts.filter(d => d.source === "coto");
    const cotoKeys = cotoDiscounts.map(generateDiscountKey);
    
    // All Coto discounts should have different keys
    const uniqueCotoKeys = new Set(cotoKeys);
    expect(uniqueCotoKeys.size).toBe(cotoDiscounts.length);
    
    console.log("\nCoto discount keys:");
    cotoKeys.forEach((key, index) => {
      const discount = cotoDiscounts[index];
      console.log(`${key} -> ${discount.discount.value}% ${discount.paymentMethods?.[0]?.[0] || 'any'} ${discount.weekdays?.join(',') || 'any day'}`);
    });
  });

  it("should handle discounts with no payment methods", () => {
    const makroDiscount = sampleDiscounts.find(d => d.source === "makro");
    expect(makroDiscount).toBeDefined();
    
    const key = generateDiscountKey(makroDiscount!);
    expect(validateDiscountKey(key)).toBe(true);
    expect(key).toContain("makro");
  });

  it("should handle discounts with multiple payment methods", () => {
    const jumboDiscount = sampleDiscounts.find(d => d.source === "jumbo");
    expect(jumboDiscount).toBeDefined();
    
    const key = generateDiscountKey(jumboDiscount!);
    expect(validateDiscountKey(key)).toBe(true);
    expect(key).toContain("jumbo");
    expect(key).toContain("galicia"); // Should use first payment method
  });

  it("should create readable keys for typical discounts", () => {
    const keys = sampleDiscounts.slice(0, 5).map(generateDiscountKey);
    
    // Keys should be human-readable and not just hashes
    keys.forEach(key => {
      expect(key).toMatch(/^[a-z]+-[a-z]+-\d+/); // Should start with source-type-value
      expect(key.length).toBeLessThanOrEqual(80);
      expect(key.length).toBeGreaterThanOrEqual(15);
    });
  });

  it("should handle edge case: very similar discounts with different limits", () => {
    const cotoMercadoPago: Discount = {
      source: "coto",
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2025-04-26",
      validUntil: "2025-04-27",
      restrictions: [],
      paymentMethods: [["Mercado Pago"]],
      unknownPaymentMethods: [],
      url: "https://example.com",
      where: ["Coto"],
      limits: { explicitlyHasNoLimit: true }
    };

    const cotoMercadoPagoWithLimit: Discount = {
      ...cotoMercadoPago,
      limits: { explicitlyHasNoLimit: false, maxDiscount: 3000 }
    };

    const key1 = generateDiscountKey(cotoMercadoPago);
    const key2 = generateDiscountKey(cotoMercadoPagoWithLimit);
    
    expect(key1).not.toBe(key2);
    expect(key1).toContain("notope");
    expect(key2).toContain("max3000");
  });
});

describe("performance and collision testing", () => {
  it("should handle large datasets efficiently", () => {
    const start = Date.now();
    
    // Generate 1000 slight variations
    const manyDiscounts: Discount[] = [];
    for (let i = 0; i < 1000; i++) {
      manyDiscounts.push({
        source: "coto",
        discount: { type: "porcentaje", value: 15 + (i % 10) },
        validFrom: `2025-${String(4 + (i % 9)).padStart(2, '0')}-01`,
        validUntil: `2025-${String(4 + (i % 9)).padStart(2, '0')}-${String(1 + (i % 28)).padStart(2, '0')}`,
        restrictions: [],
        paymentMethods: i % 3 === 0 ? [["Mercado Pago"]] : [],
        unknownPaymentMethods: [],
        url: "https://example.com",
        where: ["Coto"],
        limits: { explicitlyHasNoLimit: i % 5 === 0 }
      });
    }
    
    const keys = manyDiscounts.map(generateDiscountKey);
    const end = Date.now();
    
    console.log(`\nGenerated ${keys.length} keys in ${end - start}ms`);
    
    // Should be reasonably fast
    expect(end - start).toBeLessThan(1000);
    
    // Check for reasonable uniqueness (we expect some collisions due to similar data)
    const uniqueKeys = new Set(keys);
    const collisionRate = (keys.length - uniqueKeys.size) / keys.length;
    console.log(`Collision rate: ${(collisionRate * 100).toFixed(2)}%`);
    
    // Should have reasonable uniqueness even with similar data
    expect(collisionRate).toBeLessThan(0.1); // Less than 10% collision rate
  });
});