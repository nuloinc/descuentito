import { TURSO_PROMOS_DATABASE_URL, TURSO_PROMOS_AUTH_TOKEN } from '$env/static/private';
import { createClient } from '@libsql/client';

import { drizzle } from 'drizzle-orm/libsql';
import * as schema from 'promos-db/schema';
export * as schema from 'promos-db/schema';

const turso = createClient({
	url: TURSO_PROMOS_DATABASE_URL,
	authToken: TURSO_PROMOS_AUTH_TOKEN
});

export const db = drizzle(turso, {
	schema
});
