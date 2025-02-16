import type { PageServerLoad } from './$types';
import { db, schema } from '$lib/db';
import { eq } from 'drizzle-orm';

export const load: PageServerLoad = async () => {
	const galiciaPromotions = await db.query.promotionsTable.findMany({
		where: eq(schema.promotionsTable.source, 'galicia'),
		limit: 50
	});
	const carrefourPromotions = await db.query.promotionsTable.findMany({
		where: eq(schema.promotionsTable.source, 'carrefour')
	});
	return {
		promotions: {
			galicia: galiciaPromotions,
			carrefour: carrefourPromotions
		}
	};
};
