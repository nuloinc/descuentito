import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";
export * as schema from "./schema";

const turso = createClient({
  url: process.env.TURSO_PROMOS_DATABASE_URL!,
  authToken: process.env.TURSO_PROMOS_AUTH_TOKEN,
});

export const db = drizzle(turso, {
  schema,
});
