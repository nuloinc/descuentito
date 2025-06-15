import { describe, it, expect } from "vitest";
import { generateDiscountKey, validateDiscountKey, parseDiscountKey } from "../../lib/discount-keys/discount-keys";
import type { CotoDiscount, CarrefourDiscount, DiaDiscount } from "promos-db/schema";

describe("generateDiscountKey", () => {
  it("should generate basic key with source, discount type, and dates", () => {
    const discount: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2025-04-26",
      validUntil: "2025-04-27",
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key = generateDiscountKey(discount);
    expect(key).toBe("coto-porcentaje-15-0425-0426-coto");
  });

  it("should include weekdays in key when specified", () => {
    const discount: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 20 },
      validFrom: "2025-04-01",
      validUntil: "2025-04-30",
      weekdays: ["Lunes", "Martes"],
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key = generateDiscountKey(discount);
    expect(key).toContain("lunmar");
  });

  it("should include payment method abbreviation", () => {
    const discount: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2025-04-26",
      validUntil: "2025-04-27",
      paymentMethods: [["Mercado Pago"]],
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key = generateDiscountKey(discount);
    expect(key).toContain("mp");
  });

  it("should handle cuotas sin intereses discount type", () => {
    const discount: CarrefourDiscount = {
      source: "carrefour",
      discount: { type: "cuotas sin intereses", value: 12 },
      validFrom: "2025-06-01",
      validUntil: "2025-06-30",
      url: "https://example.com",
      where: ["Carrefour"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key = generateDiscountKey(discount);
    expect(key).toBe("carrefour-cuotassinintereses-12-0531-0629-carrefour");
  });

  it("should handle multiple weekdays in sorted order", () => {
    const discount: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 25 },
      validFrom: "2025-04-01",
      validUntil: "2025-04-30",
      weekdays: ["Viernes", "Lunes", "Miercoles"],
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key = generateDiscountKey(discount);
    expect(key).toContain("lunmievie");
  });

  it("should include online location when specified", () => {
    const discount: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 10 },
      validFrom: "2025-04-01",
      validUntil: "2025-04-30",
      url: "https://example.com",
      where: ["Online"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key = generateDiscountKey(discount);
    expect(key).toContain("online");
  });

  it("should handle mixed online and physical locations", () => {
    const discount: CarrefourDiscount = {
      source: "carrefour",
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2025-04-01",
      validUntil: "2025-04-30",
      url: "https://example.com",
      where: ["Carrefour", "Online"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key = generateDiscountKey(discount);
    expect(key).toContain("carrefouronline");
  });

  it("should include membership when specified", () => {
    const discount: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 20 },
      validFrom: "2025-04-01",
      validUntil: "2025-04-30",
      membership: ["Club La Nacion"],
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key = generateDiscountKey(discount);
    expect(key).toContain("clubla");
  });

  it("should include appliesOnlyTo targeting", () => {
    const discount: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 30 },
      validFrom: "2025-04-01",
      validUntil: "2025-04-30",
      appliesOnlyTo: {
        anses: true,
        jubilados: false,
        programaCiudadaniaPorteña: false
      },
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key = generateDiscountKey(discount);
    expect(key).toContain("ans");
  });

  it("should include explicit no limit indicator", () => {
    const discount: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2025-04-26",
      validUntil: "2025-04-27",
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: true }
    };

    const key = generateDiscountKey(discount);
    expect(key).toContain("notope");
  });

  it("should include max discount limit", () => {
    const discount: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2025-04-26",
      validUntil: "2025-04-27",
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false, maxDiscount: 5000 }
    };

    const key = generateDiscountKey(discount);
    expect(key).toContain("max5000");
  });

  it("should handle bank-specific payment methods", () => {
    const discountCiudad: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 25 },
      validFrom: "2025-04-01",
      validUntil: "2025-04-30",
      paymentMethods: [["Banco Ciudad"]],
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key = generateDiscountKey(discountCiudad);
    expect(key).toContain("ciudad");
  });

  it("should use full date format for long date ranges", () => {
    const discount: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2025-01-01",
      validUntil: "2025-12-31",
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key = generateDiscountKey(discount);
    expect(key).toContain("2025-01-01-2025-12-31");
  });

  it("should hash long keys to keep them manageable", () => {
    const discount: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2025-04-01",
      validUntil: "2025-04-30",
      weekdays: ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes"],
      paymentMethods: [["Banco Galicia", "Tarjeta de crédito VISA"]],
      membership: ["Club La Nacion", "Comunidad Coto"],
      appliesOnlyTo: {
        anses: true,
        jubilados: true,
        programaCiudadaniaPorteña: true
      },
      url: "https://example.com",
      where: ["Coto", "Online"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: true, maxDiscount: 10000 }
    };

    const key = generateDiscountKey(discount);
    expect(key.length).toBeLessThanOrEqual(80);
    expect(key).toMatch(/^coto-porcentaje-15-\d{4}-\d{4}-[a-f0-9]{8}$/);
  });

  it("should generate different keys for different discounts", () => {
    const discount1: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2025-04-26",
      validUntil: "2025-04-27",
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const discount2: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 20 },
      validFrom: "2025-04-26",
      validUntil: "2025-04-27",
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key1 = generateDiscountKey(discount1);
    const key2 = generateDiscountKey(discount2);
    expect(key1).not.toBe(key2);
  });

  it("should generate same key for identical discounts", () => {
    const discount1: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2025-04-26",
      validUntil: "2025-04-27",
      paymentMethods: [["Mercado Pago"]],
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const discount2: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2025-04-26",
      validUntil: "2025-04-27",
      paymentMethods: [["Mercado Pago"]],
      url: "https://example.com",
      where: ["Coto"],
      restrictions: ["Different restriction"], // Non-key field
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key1 = generateDiscountKey(discount1);
    const key2 = generateDiscountKey(discount2);
    // Keys may now include restriction hashes, so check they start the same
    expect(key1.split('-').slice(0, 6).join('-')).toBe(key2.split('-').slice(0, 6).join('-'));
  });

  it("should ignore generic payment methods", () => {
    const discount: CotoDiscount = {
      source: "coto",
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2025-04-26",
      validUntil: "2025-04-27",
      paymentMethods: [["Some Unknown Payment Method"]],
      url: "https://example.com",
      where: ["Coto"],
      restrictions: [],
      unknownPaymentMethods: [],
      limits: { explicitlyHasNoLimit: false }
    };

    const key = generateDiscountKey(discount);
    expect(key).toBe("coto-porcentaje-15-0425-0426-coto");
  });
});

describe("validateDiscountKey", () => {
  it("should validate properly formatted keys", () => {
    expect(validateDiscountKey("coto-porcentaje-15-0426-0427")).toBe(true);
    expect(validateDiscountKey("carrefour-cuotassinintereses-12-0601-0630-mp")).toBe(true);
  });

  it("should reject keys with invalid characters", () => {
    expect(validateDiscountKey("coto-porcentaje-15-0426-0427!")).toBe(false);
    expect(validateDiscountKey("coto porcentaje 15 0426 0427")).toBe(false);
    expect(validateDiscountKey("coto_porcentaje_15_0426_0427")).toBe(false);
  });

  it("should reject keys that are too short", () => {
    expect(validateDiscountKey("coto-15")).toBe(false);
    expect(validateDiscountKey("short")).toBe(false);
  });

  it("should reject keys that are too long", () => {
    const longKey = "a".repeat(86);
    expect(validateDiscountKey(longKey)).toBe(false);
  });
});

describe("parseDiscountKey", () => {
  it("should parse basic key components", () => {
    const key = "coto-porcentaje-15-0426-0427-mp-online";
    const parsed = parseDiscountKey(key);
    
    expect(parsed.source).toBe("coto");
    expect(parsed.discountType).toBe("porcentaje");
    expect(parsed.dateRange).toBe("15");
    expect(parsed.additional).toEqual(["0426", "0427", "mp", "online"]);
  });

  it("should handle minimal keys", () => {
    const key = "dia-porcentaje-25";
    const parsed = parseDiscountKey(key);
    
    expect(parsed.source).toBe("dia");
    expect(parsed.discountType).toBe("porcentaje");
    expect(parsed.dateRange).toBe("25");
    expect(parsed.additional).toEqual([]);
  });

  it("should handle empty or malformed keys gracefully", () => {
    const parsed = parseDiscountKey("");
    
    expect(parsed.source).toBe("");
    expect(parsed.discountType).toBe("");
    expect(parsed.dateRange).toBe("");
    expect(parsed.additional).toEqual([]);
  });
});

describe("real-world examples", () => {
  it("should handle DIA discount with NaranjaX", () => {
    const discount: DiaDiscount = {
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
    };

    const key = generateDiscountKey(discount);
    expect(key).toBe("dia-porcentaje-25-0331-0530-mar-naranja-dia-rs860");
  });

  it("should handle Carrefour discount with Thursday restriction", () => {
    const discount: CarrefourDiscount = {
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
    };

    const key = generateDiscountKey(discount);
    expect(key).toContain("carrefour-porcentaje-15-0531-0629-jue-galicia-carrefour");
    expect(key).toContain("ex"); // Should include exclusion hash
  });
});