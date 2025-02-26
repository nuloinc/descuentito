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
  "Tarjeta American Express",
  "Tarjeta American Express - The Platinum Card ® y Centurion ®",
  "Tarjeta Prepaga Mastercard",
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
  limits: z.object({
    maxDiscount: z.number().optional(),
    explicitlyHasNoLimit: z.boolean(),
  }),
});

export const PAYMENT_METHODS_PROMPT = `## PAYMENT METHODS

Represent different combinations of payment methods as separate arrays of strings.

If there are multiple combinations possible, represent each and every one of them individually.

If there are no payment methods specify (for example, if the discount only applies for a membership program), just return null.

Specific cards like "Tarjeta de crédito Coto TCI" or "Tarjeta Carrefour Crédito" are different from the general "Tarjeta de crédito VISA" or "Tarjeta de crédito Mastercard" payment methods. If the discount applies to the general payment method, only specify the general payment method.

Example: Banco Galicia with either VISA or Mastercard credit cards: [["Banco Galicia", "Tarjeta de crédito VISA"], ["Banco Galicia", "Tarjeta de crédito Mastercard"]], NOT merging them like this: [["Banco Galicia", "Tarjeta de crédito VISA", "Tarjeta de crédito Mastercard"]]

Inside each combination, sort by bank/wallet, then by payment method (if applicable), then by card type (if applicable). Example: [["Banco Santander", "MODO", "Tarjeta de crédito VISA"]].

"Banco Galicia Más" is a different payment method from "Banco Galicia". Galicia Más used to be HSBC.`;

export const RESTRICTIONS_PROMPT = `## RESTRICTIONS

Do NOT include irrelevant restrictions that are obvious, such as restrictions related to foreign credit cards, purchase cards, payments in foreign currencies, or social aid programs. Do NOT include restrictions that specify "Solo para consumo familiar.", etc. Do NOT include restrictions that specify "Descuentos, precios y promociones para consumo familiar.". Do NOT include restrictions related to Mendoza.

Do not include redundant information that is mentioned elsewhere in the object, such as validity dates, days of the week, payment methods, where the discount is valid (online or in-store) or limits.

Order by relevance, starting with the most relevant restrictions.`;

export const LIMITS_PROMPT = `## LIMITS

\`maxDiscount\` is the maximum discount amount in pesos that can be applied to the discount.

\`explicitlyHasNoLimit\` is true if the discount explicitly states that there is no limit ("sin tope").`;
