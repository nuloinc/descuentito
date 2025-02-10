import type { Config } from "drizzle-kit";

export default {
  schema: "./schema.ts",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_PROMOS_DATABASE_URL!,
    authToken: process.env.TURSO_PROMOS_AUTH_TOKEN,
  },
} satisfies Config;
