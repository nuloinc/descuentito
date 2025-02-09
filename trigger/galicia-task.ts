import { logger, schedules } from "@trigger.dev/sdk/v3";
import { extractPromotions } from "./extract-promotions";

export const galiciaPromotionsTask = schedules.task({
  id: "galicia-promotions-extractor",
  // Run every 6 hours
  cron: "0 */6 * * *",
  maxDuration: 300,
  run: async (payload, { ctx }) => {
    try {
      const promotions = await extractPromotions();
      console.log("Promotions extracted successfully", {
        count: promotions.length,
        promotions,
      });
      return {
        promotionsCount: promotions.length,
      };
    } catch (error) {
      console.error("Error running task:", error);
      throw error;
    }
  },
});

// Run the task immediately if this file is executed directly
if (require.main === module) {
  galiciaPromotionsTask.run({}, { ctx: {} } as any).catch((error) => {
    console.error("Failed to run task:", error);
    process.exit(1);
  });
}
