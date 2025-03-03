import { sql } from "drizzle-orm";
import { text, sqliteTable } from "drizzle-orm/sqlite-core";
import { z } from "zod";

export const promotionsTable = sqliteTable("promotions", {
  source: text("source").notNull(),
  json: text("json", { mode: "json" }).notNull(),
  createdAt: text("created_at")
    .notNull()
    .default(sql`CURRENT_TIMESTAMP`),
});

export const SOURCES = ["galicia"] as const;
export type Weekday =
  | "Lunes"
  | "Martes"
  | "Miercoles"
  | "Jueves"
  | "Viernes"
  | "Sabado"
  | "Domingo";
export interface GenericDiscount {
  title?: string;
  description?: string;
  category?: string;
  discount: {
    type: "porcentaje" | "cuotas sin intereses";
    value: number;
  };
  validFrom: string;
  validUntil: string;
  weekdays?: Weekday[];
  url: string;
  paymentMethods?: (string | string[])[];
  membership?: string[];
  restrictions?: string[];
  onlyForProducts?: string;
  additionalInfo?: string;
  appliesOnlyTo?: {
    anses: boolean;
    jubilados: boolean;
  };
  limits?: {
    maxDiscount?: number;
    explicitlyHasNoLimit?: boolean;
  };
}

export interface GaliciaDiscount extends GenericDiscount {
  id: number;
  source: "galicia";
}

export interface CarrefourDiscount extends GenericDiscount {
  source: "carrefour";
  where: ("Carrefour" | "Maxi" | "Market" | "Express" | "Online")[];
}
export interface CotoDiscount extends GenericDiscount {
  source: "coto";
  where: ("Coto" | "Online")[];
}
export interface DiaDiscount extends GenericDiscount {
  source: "dia";
  where: ("Dia" | "Online")[];
}
export interface JumboDiscount extends GenericDiscount {
  source: "jumbo";
  where: ("Jumbo" | "Online")[];
  paymentMethods?: PaymentMethod[][];
}

export type Discount =
  | CarrefourDiscount
  | CotoDiscount
  | DiaDiscount
  | JumboDiscount;

export const BANKS_OR_WALLETS = [
  "Mercado Pago",
  "Banco Galicia",
  "Ualá",
  "Banco Patagonia",
  "Banco BBVA",
  "Banco Nación",
  "Banco Nación - Tarjeta Nativa",
  "Banco Ciudad",
  "Banco Ciudad - Plan Sueldo y Jubilados",
  "Banco Galicia - Eminent",
  "Banco Macro",
  "Banco Santander",
  "Banco Santander - Jubilados",
  "Banco Santander - Women",
  "Banco ICBC",
  "Banco ICBC – Cliente Payroll",
  "Banco Credicoop",
  "Banco Credicoop - Plan Sueldo",
  "Banco Comafi",
  "Banco Galicia Más",
  "Banco Supervielle",
  "Banco Supervielle - Plan Sueldo",
  "Banco Supervielle - Identité",
  "Banco Supervielle - Jubilados",
  "Banco Columbia",
  "Banco del Sol",
  "Banco Entre Ríos",
  "Banco Hipotecario",
  ".Reba",
  ".Reba - Black",
  "Uilo",
  "NaranjaX",
  "Cuenta DNI",
  "Banco Santa Fe",
  "Personal Pay",
  "Prex",
  "Tarjeta Carrefour Prepaga",
  "Tarjeta Carrefour Crédito",
  "Tarjeta de crédito Coto TCI",
  "Tarjeta de crédito Cencosud Mastercard",
  "Cencopay",
  "Sidecreer",
] as const;

export const PAYMENT_METHODS = [
  ...BANKS_OR_WALLETS,
  "MODO",
  "Tarjeta de crédito VISA",
  "Tarjeta de débito VISA",
  "Tarjeta de crédito Mastercard",
  "Tarjeta de débito Mastercard",
  "Tarjeta Prepaga Mastercard",
  "Tarjeta de crédito Cabal",
  "Tarjeta de débito Cabal",
  "Tarjeta American Express",
  "Tarjeta American Express - The Platinum Card ® y Centurion ®",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const BasicDiscountSchema = z.object({
  discount: z.object({
    type: z.enum(["porcentaje", "cuotas sin intereses"]),
    value: z.number().describe("0 to 100 for percentage, 0 to 12 for cuotas"),
  }),
  validFrom: z.string().describe("YYYY-MM-DD"),
  validUntil: z.string().describe("YYYY-MM-DD"),
  weekdays: z
    .array(
      z.enum([
        "Lunes",
        "Martes",
        "Miercoles",
        "Jueves",
        "Viernes",
        "Sabado",
        "Domingo",
      ])
    )
    .optional(),
  restrictions: z.array(z.string()),
  onlyForProducts: z
    .string()
    .optional()
    .describe("e.g. 'Alimentos', 'Electrodomesticos', 'Bebidas', etc."),
  paymentMethods: z.array(z.array(z.enum(PAYMENT_METHODS))).optional(),
  unknownPaymentMethods: z.array(z.string()).optional(),
  appliesOnlyTo: z.object({
    anses: z.boolean(),
    jubilados: z.boolean(),
  }).optional(),
  limits: z.object({
    maxDiscount: z.number().optional(),
    explicitlyHasNoLimit: z.boolean(),
  }),
});

export const genStartPrompt = (source: string) =>
  `You are a helpful assistant that extracts promotions from a text and converts them into structured JSON data with relevant information for argentinian users. You're extracting promotions from ${source.toUpperCase()}'s website. Today is ${new Date().toLocaleDateString()}.`;

export const PAYMENT_METHODS_PROMPT = `## PAYMENT METHODS

Group payment methods into valid combinations that work together for a discount. Follow these rules:

1. **Grouping Logic**
   - Each valid combination must be a unique, separate array
   - Remove duplicate combinations - identical groups should only appear once
   - Include ALL possible valid combinations explicitly mentioned
   - Maintain original grouping logic from the text (don't merge separate groups)
   - Split combinations by card network (VISA/Mastercard) even when from same institution

2. **Special Cases**
   - Return null ONLY if no payment methods are mentioned
   - For generic VISA/Mastercard: use "Tarjeta de crédito VISA"/"Tarjeta de crédito Mastercard"
   - Handle bank-specific variations carefully (e.g. "Banco Galicia Más" ≠ "Banco Galicia")

3. **Structure & Ordering**
   Within each combination array, sort elements by:
   1. Financial institution (bank/wallet)
   2. Platform (e.g. MODO)
   3. Card type (credit/debit)
   4. Network (VISA/Mastercard)
   
   Example: [["Banco Galicia", "Tarjeta de crédito VISA"],["Banco Galicia", "Tarjeta de crédito Mastercard"]]

4. **Handling Unknowns**
   - Put unrecognized payment methods in "unknownPaymentMethods"
   - Never mix known/unknown in same array

5. **Discount Stacking**
   If multiple tiers exist (e.g. base discount + payment method bonus):
   - Create separate entries for each discount tier
   - Specify exact percentage for each combination
   - Example: 15% for X combo vs 10% general discount

6. **Platform Clarifications**
   - Apple Pay/Google Pay/NFC are NOT payment methods
   - "MODO" should always be included when mentioned
   - Prefer generic network names over specific card variants

7. **Deduplication**
   - Before finalizing, check for and remove any duplicate payment method arrays
   - Ensure identical combinations don't appear more than once
   - Order groups consistently to help identify duplicates

Important Notes:
- Galicia Más = former HSBC accounts
- "Cuenta DNI" and similar wallets go in first position`;

export const RESTRICTIONS_PROMPT = `## RESTRICTIONS

Exclude these categories of restrictions:
- Geographic: Any mentioning Mendoza or other regional limitations
- Payment methods: Foreign-issued cards, purchase cards, payments in foreign currencies
- Generic disclaimers: Phrases like "Solo para consumo familiar" or "Descuentos, precios y promociones para consumo familiar"

Only include restrictions that:
1. Specifically limit eligibility beyond basic requirements
2. Affect actual discount applicability
3. Introduce non-obvious limitations

Ignore redundant restrictions that appear in most promotions unless they add new constraints.

Order by relevance, starting with the most relevant restrictions.`;

export const LIMITS_PROMPT = `## LIMITS

\`maxDiscount\` is the maximum discount amount in pesos that can be applied to the discount.

\`explicitlyHasNoLimit\` is true if the discount explicitly states that there is no limit ("sin tope").`;
