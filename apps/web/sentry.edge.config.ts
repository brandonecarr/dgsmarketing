import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE ?? 0.1),
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === "production",
  });
}
