import { describe, it, expect } from "vitest";
import { cleanDiscounts } from "../lib/clean";
import type { CotoDiscount, CarrefourDiscount } from "promos-db/schema";

describe("Array Normalization", () => {
  it("should sort payment methods consistently", () => {
    const discount: CotoDiscount = {
      discount: { type: "porcentaje", value: 10 },
      validFrom: "2024-01-01",
      validUntil: "2024-12-31",
      restrictions: [],
      url: "https://example.com",
      source: "coto",
      where: ["Coto"],
      limits: { explicitlyHasNoLimit: false },
      paymentMethods: [
        ["Tarjeta de crédito VISA", "Banco Galicia"], // Should be sorted to ["Banco Galicia", "Tarjeta de crédito VISA"]
        ["Banco Nación", "Banco BBVA"], // Should be sorted to ["Banco BBVA", "Banco Nación"]
      ],
    };

    const [cleaned] = cleanDiscounts([discount]);

    expect(cleaned.paymentMethods).toEqual([
      ["Banco BBVA", "Banco Nación"], // Sorted alphabetically within group
      ["Banco Galicia", "Tarjeta de crédito VISA"], // Sorted alphabetically within group
    ]);
  });

  it("should sort weekdays in calendar order", () => {
    const discount: CotoDiscount = {
      discount: { type: "porcentaje", value: 15 },
      validFrom: "2024-01-01",
      validUntil: "2024-12-31",
      restrictions: [],
      url: "https://example.com",
      source: "coto",
      where: ["Coto"],
      limits: { explicitlyHasNoLimit: false },
      weekdays: ["Viernes", "Lunes", "Miercoles"], // Should be sorted to calendar order
    };

    const [cleaned] = cleanDiscounts([discount]);

    expect(cleaned.weekdays).toEqual(["Lunes", "Miercoles", "Viernes"]);
  });

  it("should sort where field according to defined priority", () => {
    const discount: CarrefourDiscount = {
      discount: { type: "porcentaje", value: 20 },
      validFrom: "2024-01-01",
      validUntil: "2024-12-31",
      restrictions: [],
      url: "https://example.com",
      source: "carrefour",
      limits: { explicitlyHasNoLimit: false },
      where: ["Online", "Express", "Carrefour"], // Should be sorted to priority order
    };

    const [cleaned] = cleanDiscounts([discount]);

    expect(cleaned.where).toEqual(["Carrefour", "Express", "Online"]);
  });

  it("should sort restrictions alphabetically", () => {
    const discount: CotoDiscount = {
      discount: { type: "porcentaje", value: 25 },
      validFrom: "2024-01-01",
      validUntil: "2024-12-31",
      url: "https://example.com",
      source: "coto",
      where: ["Coto"],
      limits: { explicitlyHasNoLimit: false },
      restrictions: ["Zebra restriction", "Alpha restriction", "Beta restriction"],
    };

    const [cleaned] = cleanDiscounts([discount]);

    expect(cleaned.restrictions).toEqual([
      "Alpha restriction",
      "Beta restriction", 
      "Zebra restriction"
    ]);
  });

  it("should sort membership programs according to defined order", () => {
    const discount: CotoDiscount = {
      discount: { type: "porcentaje", value: 30 },
      validFrom: "2024-01-01",
      validUntil: "2024-12-31",
      restrictions: [],
      url: "https://example.com",
      source: "coto",
      where: ["Coto"],
      limits: { explicitlyHasNoLimit: false },
      membership: ["Comunidad Coto", "Club La Nacion"], // Should be sorted to defined order
    };

    const [cleaned] = cleanDiscounts([discount]);

    expect(cleaned.membership).toEqual(["Club La Nacion", "Comunidad Coto"]);
  });

  it("should handle unknown payment methods when present", () => {
    const discount: any = {
      discount: { type: "porcentaje", value: 5 },
      validFrom: "2024-01-01", 
      validUntil: "2024-12-31",
      restrictions: [],
      url: "https://example.com",
      source: "coto",
      where: ["Coto"],
      limits: { explicitlyHasNoLimit: false },
      unknownPaymentMethods: ["Zebra Bank", "Alpha Bank", "Beta Bank"],
    };

    const [cleaned] = cleanDiscounts([discount]);

    expect(cleaned.unknownPaymentMethods).toEqual([
      "Alpha Bank",
      "Beta Bank", 
      "Zebra Bank"
    ]);
  });

  it("should preserve original data when arrays are already sorted", () => {
    const discount: CotoDiscount = {
      discount: { type: "porcentaje", value: 10 },
      validFrom: "2024-01-01",
      validUntil: "2024-12-31",
      restrictions: ["Already sorted"],
      url: "https://example.com",
      source: "coto",
      where: ["Coto"],
      limits: { explicitlyHasNoLimit: false },
      paymentMethods: [["Banco Galicia"]],
      weekdays: ["Lunes", "Martes"],
    };

    const [cleaned] = cleanDiscounts([discount]);

    // Should maintain the same structure
    expect(cleaned.paymentMethods).toEqual([["Banco Galicia"]]);
    expect(cleaned.weekdays).toEqual(["Lunes", "Martes"]);
    expect(cleaned.restrictions).toEqual(["Already sorted"]);
    expect(cleaned.where).toEqual(["Coto"]);
  });
});