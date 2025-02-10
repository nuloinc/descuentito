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
export interface GaliciaPromotion {
  id: number;
  title: string;
  description: string;
  category?: string;
  discount: {
    type: string;
    value: string;
  };
  validFrom: string;
  validUntil: string;
  url: string;
  paymentMethods?: string[];
  restrictions?: string[];
  additionalInfo?: string;
  limits?: {
    maxDiscount?: number;
  };
}
