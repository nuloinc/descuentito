import { logger, schedules } from "@trigger.dev/sdk";
import { extractPromotions } from "./extract-promotions";
import { BUCKET_NAME, s3 } from "../fetch-cacher";
import { format } from "date-fns";
import { PutObjectCommand } from "@aws-sdk/client-s3";
// import { db, schema } from "promos-db/db";
import { eq, sql } from "drizzle-orm";

export const galiciaPromotionsTask = schedules.task({
  id: "galicia-promotions-extractor",
  maxDuration: 300,
  run: async (payload, { ctx }) => {
    const promotions = await extractPromotions();
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: `${format(
          new Date(),
          "yyyy-MM-dd"
        )}/galicia/${new Date().toISOString()}.json`,
        Body: JSON.stringify(promotions),
      })
    );

    // await db.transaction(async (tx) => {
    //   await tx
    //     .delete(schema.promotionsTable)
    //     .where(sql`${schema.promotionsTable.source} = 'galicia'`);
    //   await tx.insert(schema.promotionsTable).values(
    //     promotions.map((promo) => ({
    //       source: "galicia",
    //       json: promo,
    //     }))
    //   );
    // });
  },
});
