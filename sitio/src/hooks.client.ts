import { handleErrorWithSentry, replayIntegration } from "@sentry/sveltekit";
import * as Sentry from '@sentry/sveltekit';

Sentry.init({
  dsn: 'https://fbba219837609bcc6c804579312cbcb6@o4507188153548800.ingest.de.sentry.io/4508938894377040',

  tracesSampleRate: 1.0,


});

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = handleErrorWithSentry();
