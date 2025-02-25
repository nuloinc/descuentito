import { SOURCES } from '@/index';
import type { PageServerLoad } from './$types';
import type { GenericDiscount, Discount } from 'promos-db/schema';
import { dev } from '$app/environment';
import { readFile } from 'node:fs/promises';

export const load: PageServerLoad = async ({ platform }) => {
	const data = Object.fromEntries(
		await Promise.all(
			SOURCES.map(async (source) => {
				let kv = await platform?.env?.DESCUENTITO_DATA.get(source);

				if (dev) {
					kv = await readFile(`../../descuentito-data/${source}.json`, 'utf-8');
				}

				if (!kv) {
					console.warn(`Fetching ${source} from GitHub`);
					kv = await fetch(
						`https://raw.githubusercontent.com/nuloinc/descuentito-data/refs/heads/main/${source}.json`
					).then((res) => res.text());
				}
				if (!kv) return [source, []];
				return [source, JSON.parse(kv) as Discount[]];
			})
		)
	) as { [key in (typeof SOURCES)[number]]: Discount[] };
	return {
		promotions: data
	};
};
