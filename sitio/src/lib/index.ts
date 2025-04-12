// place files you want to import through the `$lib` alias in this folder.

import { persistentAtom, persistentMap } from '@nanostores/persistent';
import type { PAYMENT_METHODS } from 'promos-db/schema';

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SOURCES = ['carrefour', 'coto', 'dia', 'jumbo', 'changomas', 'makro'] as const;

export const SUPERMARKET_NAMES: Record<string, string> = {
	carrefour: 'Carrefour',
	coto: 'Coto',
	dia: 'Dia',
	jumbo: 'Jumbo',
	changomas: 'ChangoMas',
	makro: 'Makro'
};

export const savedPaymentMethods = persistentAtom<Set<PaymentMethod>>(
	'savedPaymentMethods',
	new Set(),
	{
		encode: (value) => JSON.stringify([...value]),
		decode: (value) => new Set(JSON.parse(value))
	}
);

export const filteringByPaymentMethods = persistentAtom<boolean>(
	'filteringByPaymentMethods',
	true,
	{ encode: JSON.stringify, decode: JSON.parse }
);
export const shouldFilterByPaymentMethods = $derived(
	filteringByPaymentMethods.get() && savedPaymentMethods.get().size > 0
);

export const savedConditions = persistentMap<{
	jubilados: boolean;
	anses: boolean;
}>(
	'savedConditions:',
	{ jubilados: false, anses: false },
	{ encode: JSON.stringify, decode: JSON.parse }
);
