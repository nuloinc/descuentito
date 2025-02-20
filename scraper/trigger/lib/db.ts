import { db, schema } from "promos-db/db";
import { sql } from "drizzle-orm";
import { GenericPromotion } from "promos-db/schema";
import { logger } from "@trigger.dev/sdk/v3";
import { storeCacheData } from "../../lib";

export async function savePromotions(
  source: string,
  promotions: GenericPromotion[]
) {
  await storeCacheData(source, ".json", JSON.stringify(promotions));

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.promotionsTable)
      .where(sql`${schema.promotionsTable.source} = ${source}`);
    await tx.insert(schema.promotionsTable).values(
      promotions.map((promo) => ({
        source,
        json: promo,
      }))
    );
  });

  logger.info("Saved promotions", {
    count: promotions.length,
    promotions,
  });
}
