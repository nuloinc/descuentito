import { sql } from "drizzle-orm";
import { text, sqliteTable } from "drizzle-orm/sqlite-core";
import { z } from "zod";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);

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
  excludesProducts?: string;
  additionalInfo?: string;
  appliesOnlyTo?: {
    anses: boolean;
    jubilados: boolean;
    programaCiudadaniaPorteña: boolean;
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

export interface ChangoMasDiscount extends GenericDiscount {
  source: "changomas";
  where: ("ChangoMas" | "Online")[];
}
export interface MakroDiscount extends GenericDiscount {
  source: "makro";
  where: "Makro"[];
}

export type Discount =
  | CarrefourDiscount
  | CotoDiscount
  | DiaDiscount
  | JumboDiscount
  | ChangoMasDiscount
  | MakroDiscount;

export const BANKS_OR_WALLETS = [
  "Mercado Pago",
  "Banco Galicia",
  "Banco Ciudad",
  "Banco Ciudad - Plan Sueldo y Jubilados",
  "Personal Pay",
  "Uala",
  "Banco Patagonia",
  "Banco BBVA",
  "Banco Nación",
  "Banco Nación - Tarjeta Nativa",
  "Banco Galicia - Eminent",
  "Banco Macro",
  "Banco Macro - Tarjeta PLATINUM",
  "Banco Macro - Tarjeta Selecta",
  "Banco Santander",
  "Banco Santander - Jubilados",
  "Banco Santander - Women",
  "Banco ICBC",
  "Banco ICBC - Cliente Payroll",
  "Banco Credicoop",
  "Banco Credicoop - Plan Sueldo",
  "Banco Comafi",
  "Banco Galicia Más",
  "Banco Supervielle",
  "Banco Supervielle - Identité y Plan Sueldo",
  "Banco Supervielle - Jubilados",
  "Banco Columbia",
  "Banco del Sol",
  "Banco Entre Ríos",
  "Banco Hipotecario",
  "Banco Hipotecario - Búho/Plan Sueldo",
  "Banco San Juan",
  "Banco Santa Cruz",
  ".Reba",
  ".Reba - Black",
  "Uilo",
  "NaranjaX",
  "Cuenta DNI",
  "Banco Santa Fe",
  "Prex",
  "Yoy",
  "Tarjeta Carrefour Prepaga",
  "Tarjeta Carrefour Crédito",
  "Tarjeta de crédito Coto TCI",
  "Tarjeta de crédito Cencosud Mastercard",
  "Cencopay",
  "Sidecreer",
  "Tarjeta de Crédito Patagonia 365",
  "Tarjeta de Crédito Sol",
  "BanCo (Banco de Corrientes)",
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

export type PaymentMethodGroup = (typeof PAYMENT_METHODS)[number] | "other";
export const JOIN_GROUPS: (typeof PAYMENT_METHODS)[number][][] = [
  ["Banco Credicoop", "Banco Credicoop - Plan Sueldo"],
  ["Banco ICBC", "Banco ICBC - Cliente Payroll"],
  ["Banco Galicia", "Banco Galicia - Eminent"],
  ["Tarjeta Carrefour Crédito", "Tarjeta Carrefour Prepaga"],
  [".Reba", ".Reba - Black"],
  ["Banco Ciudad", "Banco Ciudad - Plan Sueldo y Jubilados"],
  [
    "Banco Supervielle",
    "Banco Supervielle - Identité y Plan Sueldo",
    "Banco Supervielle - Jubilados",
  ],
  ["Banco Nación", "Banco Nación - Tarjeta Nativa"],
  ["Banco Santander", "Banco Santander - Jubilados", "Banco Santander - Women"],
  ["Banco Hipotecario", "Banco Hipotecario - Búho/Plan Sueldo"],
  [
    "Banco Macro",
    "Banco Macro - Tarjeta PLATINUM",
    "Banco Macro - Tarjeta Selecta",
  ],
];

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
  excludesProducts: z
    .string()
    .describe("e.g. 'Vinos, Harina', 'Marca Coca Cola, Alcohol', etc.")
    .optional(),
  paymentMethods: z.array(z.array(z.enum(PAYMENT_METHODS))).optional(),
  unknownPaymentMethods: z.array(z.string()),
  appliesOnlyTo: z
    .object({
      anses: z.boolean(),
      jubilados: z.boolean(),
      programaCiudadaniaPorteña: z.boolean(),
    })
    .optional(),
  limits: z.object({
    maxDiscount: z.number().optional(),
    explicitlyHasNoLimit: z.boolean(),
  }),
});

export const genStartPrompt = (source: string) =>
  `You are a helpful assistant that extracts promotions from text and/or screenshots and converts them into structured JSON data with relevant information for argentinian users. You're extracting promotions from ${source.toUpperCase()}'s website. Today is ${dayjs(
    undefined,
    "America/Argentina/Buenos_Aires"
  ).format("dddd, DD MMMM YYYY")}.`;
export const PAYMENT_METHODS_PROMPT = `## PAYMENT METHODS

Group payment methods into valid combinations that work together for a discount. Follow these rules:

1. **Grouping Logic**
   - Each valid combination must be a unique, separate array
   - Remove duplicate combinations - identical groups should only appear once
   - Include ALL possible valid combinations explicitly mentioned
   - Maintain original grouping logic from the text (don't merge separate groups)
   - Split combinations by card network (VISA/Mastercard) even when from same institution

2. **Special Cases**
   - If "todos los medios de pago" or similar is mentioned, return null to indicate all payment methods are accepted.
   - Return null ONLY if no payment methods are mentioned or "todos los medios de pago" is present.
   - For generic VISA/Mastercard: use "Tarjeta de crédito VISA"/"Tarjeta de crédito Mastercard"
   - Handle bank-specific variations carefully (e.g. "Banco Galicia Más" ≠ "Banco Galicia")
   - Account for special account types like "Plan Sueldo" when explicitly mentioned
   - If multiple Niveles are specified for "Personal Pay", just use the first one

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
   - Specify exact percentage for each combination including COMBINED totals
   - Example: 10% base discount + 15% total (10% base + 5% payment method/membership bonus)

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
- Plan Z = Naranja X VISA Crédito
- Caja de ahorro App Ualá = "Uala"
- "Cuenta DNI" and similar wallets go in first position
- "Plan Sueldo" accounts should be specified when mentioned as a requirement`;

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

Order by relevance, starting with the most relevant restrictions.

"appliesOnlyTo" should ONLY be used for restrictions that EXCLUDE other categories of people.`;

export const PRODUCTS_PROMPT = `## PRODUCTS COVERAGE

There are two fields that define product coverage for a promotion:

\`onlyForProducts\`: If the promotion is limited to specific product categories, list them here (e.g., 'Alimentos', 'Electrodomesticos', 'Bebidas'). Leave empty if promotion applies to all products (do NOT use "N/A" or similar).

\`excludesProducts\`: List any products or product categories explicitly excluded from the promotion (e.g., 'Vinos, Harina', 'Marca Coca Cola, Alcohol'). This field is critical for accurately representing promotion limitations.
- Do not specify non-product restrictions -- instead, use \`restrictions\` for those.`;

export const LIMITS_PROMPT = `## LIMITS

\`maxDiscount\` is the maximum discount amount in pesos that can be applied to the discount.

\`explicitlyHasNoLimit\` is true if the discount explicitly states that there is no limit ("sin tope").

\`validFrom\` and \`validUntil\` are the dates when the discount is valid. If there's no mention of a valid from date, assume it's valid this month.`;
