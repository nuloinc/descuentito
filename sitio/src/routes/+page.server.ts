import type { PageServerLoad } from './$types';
import { db } from '$lib/db';

export const load: PageServerLoad = async () => {
	const promotions = await db.query.promotionsTable.findMany({
		limit: 50
	});
	return {
		promotions
	};
};
