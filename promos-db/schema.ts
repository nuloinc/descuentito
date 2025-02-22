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
export interface GenericPromotion {
  title: string;
  description?: string;
  category?: string;
  discount: {
    type: "porcentaje" | "cuotas sin intereses" | {};
    value: number;
  };
  validFrom: string;
  validUntil: string;
  weekdays?: Weekday[];
  url: string;
  paymentMethods?: (string | string[])[];
  membership?: string[];
  restrictions?: string[];
  additionalInfo?: string;
  limits?: {
    maxDiscount?: number;
    explicitlyHasNoLimit?: boolean;
  };
}

export interface GaliciaPromotion extends GenericPromotion {
  id: number;
  source: "galicia";
}

export interface CarrefourPromotion extends GenericPromotion {
  source: "carrefour";
  where: ("Carrefour" | "Maxi" | "Market" | "Express" | "Online")[];
}
export interface CotoPromotion extends GenericPromotion {
  source: "coto";
  where: ("Coto" | "Online")[];
}
export interface DiaPromotion extends GenericPromotion {
  source: "dia";
  where: ("Dia" | "Online")[];
}
export interface JumboPromotion extends GenericPromotion {
  source: "jumbo";
  where: ("Jumbo" | "Online")[];
}

export type Promotion = CarrefourPromotion | CotoPromotion;

export const BANKS_OR_WALLETS = [
  "Mercado Pago",
  "Banco Galicia",
  "Ualá",
  "Banco Patagonia",
  "Banco BBVA",
  "Banco Nación",
  "Banco Ciudad",
  "Banco Galicia - Eminent",
  "Banco Macro",
  "Banco Santander",
  "Banco ICBC",
  "Banco ICBC – Cliente Payroll",
  "Banco Credicoop",
  "Banco Credicoop - Plan Sueldo",
  "Banco Santander",
  "Banco Comafi",
  "Banco Galicia Más",
  "Banco Supervielle",
  "Banco Columbia",
  "Banco del Sol",
  "Reba",
  "MODO",
  "Uilo",
  "NaranjaX",
  "Cuenta DNI",
  "Tarjeta Carrefour Prepaga",
  "Tarjeta Carrefour Crédito",
];

export const PAYMENT_METHODS = [
  ...BANKS_OR_WALLETS,
  "Tarjeta de crédito VISA",
  "Tarjeta de débito VISA",
  "Tarjeta de crédito Mastercard",
  "Tarjeta de débito Mastercard",
  "Tarjeta American Express",
  "Tarjeta Prepaga Mastercard",
  "Tarjeta de Crédito Coto TCI",
  "Tarjeta Carrefour Prepaga",
  "Tarjeta Carrefour Crédito",
] as const;

export const BasicPromotionSchema = z.object({
  title: z.string(),
  category: z.string().optional(),
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
  paymentMethods: z
    .array(
      z.array(
        z.enum([
          "Banco Patagonia",
          "Banco BBVA",
          "Banco Nación",
          "Banco Ciudad",
          "Banco Galicia",
          "Banco Galicia - Eminent",
          "Banco Macro",
          "Banco Santander",
          "Banco ICBC",
          "Banco ICBC – Cliente Payroll",
          "Banco Credicoop",
          "Banco Credicoop - Plan Sueldo",
          "Banco Santander",
          "Banco Comafi",
          "Banco Galicia Más",
          "Banco Supervielle",
          "Banco Columbia",
          "Banco del Sol",
          "Reba",
          "Mercado Pago",
          "Dinero en cuenta",
          "MODO",
          "Ualá",
          "Uilo",
          "NaranjaX",
          "Cuenta DNI",
          "Tarjeta Carrefour Prepaga",
          "Tarjeta Carrefour Crédito",
          "Tarjeta de crédito VISA",
          "Tarjeta de débito VISA",
          "Tarjeta de crédito Mastercard",
          "Tarjeta de débito Mastercard",
          "Tarjeta American Express",
          "Tarjeta Prepaga Mastercard",
          "Tarjeta de Crédito Coto TCI",
        ])
      )
    )
    .optional(),
  limits: z.object({
    maxDiscount: z.number().optional(),
    explicitlyHasNoLimit: z.boolean().optional(),
  }),
});

export const PAYMENT_METHODS_PROMPT = `PAYMENT METHODS

Represent different combinations of payment methods as separate arrays of strings.

If there are multiple combinations possible, represent each and every one of them individually.

Example: Banco Galicia with either VISA or Mastercard credit cards: [["Banco Galicia", "Tarjeta de crédito VISA"], ["Banco Galicia", "Tarjeta de crédito Mastercard"]], NOT merging them like this: [["Banco Galicia", "Tarjeta de crédito VISA", "Tarjeta de crédito Mastercard"]]

"Banco Galicia Más" is a different payment method from "Banco Galicia".`;

export const RESTRICTIONS_PROMPT = `RESTRICTIONS

Do not include irrelevant restrictions that are obvious, such as restrictions related to foreign credit cards, purchase cards, payments in foreign currencies, or social aid programs, or restrictions that specify "Solo para consumo familiar.".

Do not include redundant information that is mentioned elsewhere in the object, such as validity dates, days of the week, payment methods, where the promotion is valid or limits.

Order by relevance, starting with the most relevant restrictions.`;

export const LIMITS_PROMPT = `LIMITS

\`maxDiscount\` is the maximum discount amount in pesos that can be applied to the promotion.

\`explicitlyHasNoLimit\` is true if the promotion explicitly states that there is no limit ("sin tope").`;
