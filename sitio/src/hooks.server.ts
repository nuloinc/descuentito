import { sequence } from '@sveltejs/kit/hooks';
import { handleErrorWithSentry, sentryHandle } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';

// https://github.com/Lms24/sveltekit-cloudflare-test/blob/main/src/hooks.server.ts

// If you have custom handlers, make sure to place them after `sentryHandle()` in the `sequence` function.
export const handle = sequence(
	Sentry.initCloudflareSentryHandle({
		dsn: 'https://fbba219837609bcc6c804579312cbcb6@o4507188153548800.ingest.de.sentry.io/4508938894377040',

		tracesSampleRate: 1.0

		// uncomment the line below to enable Spotlight (https://spotlightjs.com)
		// spotlight: import.meta.env.DEV,
	}),
	sentryHandle()
);

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = handleErrorWithSentry();
