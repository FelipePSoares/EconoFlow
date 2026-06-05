import * as Sentry from '@sentry/react-native';

/**
 * Created at module-import time so it is available as an argument to
 * Sentry.init() and can be exported for use in NavigationContainer.
 */
export const navigationIntegration = Sentry.reactNavigationIntegration();

/**
 * Initialise Sentry.  Call this once, at the top of App.tsx before any
 * React rendering starts.
 *
 * – Disabled in development builds (__DEV__ === true) to keep the dashboard
 *   clean during day-to-day work.
 * – The DSN is read from the EXPO_PUBLIC_SENTRY_DSN environment variable,
 *   which Metro bakes into the JS bundle at build time.
 */
export function initSentry(): void {
  Sentry.init({
    // Must use dot notation — Metro's Babel transform only replaces
    // process.env.VARIABLE statically; bracket notation yields undefined.
    // eslint-disable-next-line dot-notation
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    enabled: !__DEV__,
    environment: __DEV__ ? 'development' : 'production',
    // 20 % of screen-transitions produce a trace. Raise once you have
    // real users and need higher fidelity.
    tracesSampleRate: 0.2,
    // 10 % of sampled traces also carry a Hermes CPU profile, which
    // surfaces slow renders and expensive computations early.
    profilesSampleRate: 0.1,
    // Capture the React component tree on every crash so the Sentry event
    // shows which screen and component were active. Safe for a finance app:
    // the view hierarchy contains component names only, never field values
    // or financial amounts.
    attachViewHierarchy: true,
    // Explicitly disabled: screenshots would expose financial data on screen.
    attachScreenshot: false,
    // Restrict distributed-trace headers to the EconoFlow API only.
    // Without this, every Axios request would carry Sentry trace headers,
    // including any third-party calls added later.
    tracePropagationTargets: [/^https:\/\/econoflow\.pt/],
    integrations: [navigationIntegration],
    beforeSend(event) {
      // Strip the Authorization header so tokens never reach the Sentry
      // ingest endpoint, regardless of what the HTTP layer captured.
      const headers = event.request?.headers as Record<string, string> | undefined;
      if (headers) {
        delete headers['Authorization'];
        delete headers['authorization'];
      }
      return event;
    },
  });
}

/**
 * Capture an unexpected error with optional extra context.
 * Use this in try/catch blocks or React error boundaries.
 *
 * @param error   - The caught value (Error, string, etc.)
 * @param context - Free-form key/value pairs added as Sentry "extras".
 *                  NEVER include financial amounts, PII, or secrets here.
 */
export function captureError(error: unknown, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Associate the current Sentry session with a user.
 * Only the opaque user ID is sent — never email, name, or any other PII.
 */
export function setUserContext(userId: string): void {
  Sentry.setUser({ id: userId });
}

/** Remove the Sentry user context (call on logout). */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Append a manual breadcrumb to the current Sentry event chain.
 *
 * @param message  - Short description of what happened.
 * @param category - Dot-separated category, e.g. "http" or "auth".
 *                   Defaults to "app".
 * @param data     - Optional structured data.
 *                   NEVER include amounts, tokens, or personal data.
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  data?: Record<string, unknown>,
): void {
  Sentry.addBreadcrumb({
    message,
    category: category ?? 'app',
    data,
    level: 'info',
  });
}
