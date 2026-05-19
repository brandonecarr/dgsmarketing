import * as Sentry from "@sentry/nextjs";

if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_RATE ?? 0.1),
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
    enabled: process.env.NODE_ENV === "production",
    // Don't capture URLs containing sensitive query params.
    beforeSend(event) {
      if (event.request?.url?.includes("session_id=")) return null;
      return event;
    },
  });
}
