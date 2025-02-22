import type { PageServerLoad } from './$types';
import type { GenericPromotion, Promotion } from 'promos-db/schema';

const sources = ['carrefour', 'coto', 'dia'] as const;

export const load: PageServerLoad = async ({ platform }) => {
	const data = Object.fromEntries(
		await Promise.all(
			sources.map(async (source) => {
				let kv = await platform?.env?.DESCUENTITO_DATA.get(source);
				if (!kv) {
					console.warn(`Fetching ${source} from GitHub`);
					kv = await fetch(
						`https://raw.githubusercontent.com/nuloinc/descuentito-data/refs/heads/main/${source}.json`
					).then((res) => res.text());
				}
				if (!kv) return [source, []];
				return [source, JSON.parse(kv) as Promotion[]];
			})
		)
	) as { [key in (typeof sources)[number]]: Promotion[] };
	return {
		promotions: data
	};
};
