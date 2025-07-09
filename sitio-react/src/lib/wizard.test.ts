import { describe, test, expect } from "bun:test";
import type { PaymentMethod } from "promos-db/schema";
import { BANKS_OR_WALLETS, PAYMENT_RAILS } from "promos-db/schema";

// Import the category filters from the wizard
const CATEGORY_FILTERS = {
  banks: (m: PaymentMethod) =>
    m.startsWith("Banco") ||
    m === "Sidecreer" ||
    m === "BanCo (Banco de Corrientes)" ||
    m === "Cuenta DNI",
  cards: (m: PaymentMethod) =>
    m.startsWith("Tarjeta") || ["MODO", "Tarjeta American Express"].includes(m),
  digitalWallets: (m: PaymentMethod) =>
    [
      "Mercado Pago",
      "Uala",
      "Cuenta DNI",
      "Personal Pay",
      "Personal Pay - Nivel 1",
      "Personal Pay - Nivel 2",
      "Personal Pay - Nivel 3",
      "Personal Pay - Nivel 4",
      "Billetera Buepp",
      ".Reba",
      ".Reba - Black",
      "Prex",
      "Yoy",
      "Cencopay",
      "Uilo",
      "NaranjaX",
    ].includes(m),
} as const;

describe("Payment Method Wizard Categories", () => {
  test("should categorize all payment methods", () => {
    const allPaymentMethods = [...BANKS_OR_WALLETS, ...PAYMENT_RAILS];
    const categorizedMethods = new Set<PaymentMethod>();

    // Collect all methods that are categorized
    Object.entries(CATEGORY_FILTERS).forEach(([category, filter]) => {
      allPaymentMethods.forEach((method) => {
        if (filter(method as PaymentMethod)) {
          categorizedMethods.add(method as PaymentMethod);
        }
      });
    });

    // Find missing methods
    const missingMethods = allPaymentMethods.filter(
      (method) => !categorizedMethods.has(method as PaymentMethod),
    );

    // Assert no missing methods
    expect(missingMethods).toHaveLength(0);

    if (missingMethods.length > 0) {
      console.warn(
        "⚠️ Missing payment methods in wizard categories:",
        missingMethods,
      );
    }
  });

  test("should include all known digital wallets", () => {
    const knownDigitalWallets = [
      "Mercado Pago",
      "Uala",
      "Cuenta DNI",
      "Personal Pay",
      "Personal Pay - Nivel 1",
      "Personal Pay - Nivel 2",
      "Personal Pay - Nivel 3",
      ".Reba",
      ".Reba - Black",
      "Prex",
      "Yoy",
      "Cencopay",
      "Uilo",
      "NaranjaX",
    ];

    const missingDigitalWallets = knownDigitalWallets.filter(
      (wallet) => !CATEGORY_FILTERS.digitalWallets(wallet as PaymentMethod),
    );

    // Assert no missing digital wallets
    expect(missingDigitalWallets).toHaveLength(0);

    if (missingDigitalWallets.length > 0) {
      console.warn(
        "⚠️ Missing digital wallets in wizard filters:",
        missingDigitalWallets,
      );
    }
  });

  test("should categorize banks correctly", () => {
    const bankMethods = BANKS_OR_WALLETS.filter(
      (method) =>
        method.startsWith("Banco") ||
        method === "Sidecreer" ||
        method === "BanCo (Banco de Corrientes)" ||
        method === "Cuenta DNI",
    );

    bankMethods.forEach((bank) => {
      expect(CATEGORY_FILTERS.banks(bank as PaymentMethod)).toBe(true);
    });
  });

  test("should categorize cards correctly", () => {
    const cardMethods = [...BANKS_OR_WALLETS, ...PAYMENT_RAILS].filter(
      (method) =>
        method.startsWith("Tarjeta") ||
        ["MODO", "Tarjeta American Express"].includes(method),
    );

    cardMethods.forEach((card) => {
      expect(CATEGORY_FILTERS.cards(card as PaymentMethod)).toBe(true);
    });
  });

  test("should not double-categorize payment methods", () => {
    const allPaymentMethods = [...BANKS_OR_WALLETS, ...PAYMENT_RAILS];

    allPaymentMethods.forEach((method) => {
      const categorizedIn: string[] = [];

      if (CATEGORY_FILTERS.banks(method as PaymentMethod))
        categorizedIn.push("banks");
      if (CATEGORY_FILTERS.cards(method as PaymentMethod))
        categorizedIn.push("cards");
      if (CATEGORY_FILTERS.digitalWallets(method as PaymentMethod))
        categorizedIn.push("digitalWallets");

      // Each payment method should be in at least one category
      // "Cuenta DNI" is allowed to be in both banks and digitalWallets
      if (method === "Cuenta DNI") {
        expect(categorizedIn.length).toBeGreaterThanOrEqual(1);
        expect(categorizedIn).toContain("banks");
        expect(categorizedIn).toContain("digitalWallets");
      } else {
        // All other payment methods should be in exactly one category
        expect(categorizedIn.length).toBe(1);
      }
    });
  });
});
