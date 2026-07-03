import * as Sentry from "@sentry/react";

// Basic error tracking only. Sentry's default integrations capture unhandled
// exceptions and promise rejections globally — enough to see frontend crashes
// and, once we correlate, the "action lost / phantom reload" fallout of the
// token-refresh race. Tracing / replay / router integration come later.
//
// Guarded on PROD so `vite` dev and the e2e dev server (both run in dev mode)
// never report. Unit tests don't import this module. DSN is the public client
// key for the personal-f5k / node-cloudflare-workers project (same as worker).
if (import.meta.env.PROD) {
  Sentry.init({
    dsn: "https://b6e18e27016b0b4b7174c3b2fd7680b3@o4511668612759552.ingest.us.sentry.io/4511668622983173",
    tracesSampleRate: 0,
    sendDefaultPii: false,
  });
}
