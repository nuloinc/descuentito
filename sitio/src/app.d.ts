import { KVNamespace, DurableObjectNamespace } from '@cloudflare/workers-types';
// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
	namespace App {
		interface Platform {
			env?: {
				DESCUENTITO_DATA: KVNamespace;
			};
			// interface Error {}
			// interface Locals {}
			// interface PageData {}
			// interface PageState {}
		}
	}
}

export {};
