// place files you want to import through the `$lib` alias in this folder.

import type { PAYMENT_METHODS } from 'promos-db/schema';

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const SOURCES = ['carrefour', 'coto', 'dia', 'jumbo'] as const;
