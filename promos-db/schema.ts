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
    type: string;
    value: number;
  };
  validFrom: string;
  validUntil: string;
  weekdays?: Weekday[];
  url: string;
  paymentMethods?: (string | string[])[];
  restrictions?: string[];
  additionalInfo?: string;
  limits?: {
    maxDiscount?: number;
  };
}

export interface GaliciaPromotion extends GenericPromotion {
  id: number;
  source: "galicia";
}

export interface CarrefourPromotion extends GenericPromotion {
  source: "carrefour";
}
