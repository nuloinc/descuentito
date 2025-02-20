import { sql } from "drizzle-orm";
import { text, sqliteTable } from "drizzle-orm/sqlite-core";

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
  description: string;
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
