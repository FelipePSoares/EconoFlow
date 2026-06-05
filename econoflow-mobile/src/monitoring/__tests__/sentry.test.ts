// All imports first — Jest hoists jest.mock() calls before any imports at
// runtime regardless of their position in source, so this ordering is safe.
import * as Sentry from '@sentry/react-native';
import {
  initSentry,
  captureError,
  setUserContext,
  clearUserContext,
  addBreadcrumb,
  navigationIntegration,
} from '../sentry';

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  withScope: jest.fn((fn: (scope: { setExtras: jest.Mock }) => void) => {
    fn({ setExtras: jest.fn() });
  }),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  reactNavigationIntegration: jest.fn(() => ({
    registerNavigationContainer: jest.fn(),
  })),
  wrap: jest.fn((component: unknown) => component),
}));

describe('sentry monitoring module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── initSentry ──────────────────────────────────────────────────────────────
  describe('initSentry', () => {
    it('calls Sentry.init once', () => {
      initSentry();
      expect(Sentry.init).toHaveBeenCalledTimes(1);
    });

    it('passes EXPO_PUBLIC_SENTRY_DSN as dsn', () => {
      // In Jest, process.env assignment works regardless of dot/bracket notation.
      // In the production Metro bundle only dot notation is statically replaced,
      // which is why sentry.ts uses process.env.EXPO_PUBLIC_SENTRY_DSN.
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://test@o123.ingest.sentry.io/456';
      initSentry();
      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({ dsn: 'https://test@o123.ingest.sentry.io/456' }),
      );
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;
    });

    it('sets enabled to false because __DEV__ is true in the test environment', () => {
      initSentry();
      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: false }),
      );
    });

    it('sets environment to development because __DEV__ is true in the test environment', () => {
      initSentry();
      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({ environment: 'development' }),
      );
    });

    it('includes navigationIntegration in the integrations array', () => {
      initSentry();
      const config = (Sentry.init as jest.Mock).mock.calls[0][0] as { integrations: unknown[] };
      expect(config.integrations).toContain(navigationIntegration);
    });

    it('sets tracesSampleRate to 0.2', () => {
      initSentry();
      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({ tracesSampleRate: 0.2 }),
      );
    });

    it('restricts trace propagation to the econoflow.pt domain', () => {
      initSentry();
      const config = (Sentry.init as jest.Mock).mock.calls[0][0] as {
        tracePropagationTargets: RegExp[];
      };
      const targets = config.tracePropagationTargets;
      expect(targets).toBeDefined();
      expect(targets.some((t) => t.test('https://econoflow.pt/api/projects'))).toBe(true);
      expect(targets.some((t) => t.test('https://other-domain.com'))).toBe(false);
    });
  });

  // ── captureError ─────────────────────────────────────────────────────────────
  describe('captureError', () => {
    it('calls Sentry.captureException with the error', () => {
      const error = new Error('test error');
      captureError(error);
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('does not call withScope when no context is provided', () => {
      captureError(new Error('no context'));
      expect(Sentry.withScope).not.toHaveBeenCalled();
    });

    it('calls Sentry.withScope when context is provided', () => {
      captureError(new Error('with context'), { screen: 'LoginScreen' });
      expect(Sentry.withScope).toHaveBeenCalledTimes(1);
    });

    it('calls captureException inside the scope when context is provided', () => {
      const error = new Error('scoped error');
      captureError(error, { screen: 'LoginScreen' });
      expect(Sentry.captureException).toHaveBeenCalledWith(error);
    });

    it('works with non-Error values (string, object)', () => {
      captureError('string error');
      expect(Sentry.captureException).toHaveBeenCalledWith('string error');
    });
  });

  // ── setUserContext ───────────────────────────────────────────────────────────
  describe('setUserContext', () => {
    it('calls Sentry.setUser with only the user id', () => {
      setUserContext('user-abc-123');
      expect(Sentry.setUser).toHaveBeenCalledWith({ id: 'user-abc-123' });
    });

    it('does not include email in the user context (PII hygiene)', () => {
      setUserContext('user-abc-123');
      const arg = (Sentry.setUser as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(arg).not.toHaveProperty('email');
    });

    it('does not include name in the user context (PII hygiene)', () => {
      setUserContext('user-abc-123');
      const arg = (Sentry.setUser as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(arg).not.toHaveProperty('name');
    });
  });

  // ── clearUserContext ─────────────────────────────────────────────────────────
  describe('clearUserContext', () => {
    it('calls Sentry.setUser with null', () => {
      clearUserContext();
      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  // ── addBreadcrumb ────────────────────────────────────────────────────────────
  describe('addBreadcrumb', () => {
    it('calls Sentry.addBreadcrumb with the given message', () => {
      addBreadcrumb('User tapped Dashboard');
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'User tapped Dashboard' }),
      );
    });

    it('defaults category to "app" when not provided', () => {
      addBreadcrumb('some action');
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'app' }),
      );
    });

    it('uses the provided category', () => {
      addBreadcrumb('GET /api/projects', 'http');
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'http' }),
      );
    });

    it('forwards data when provided', () => {
      addBreadcrumb('API call', 'http', { status: 200, url: '/api/projects' });
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 200, url: '/api/projects' } }),
      );
    });

    it('sets breadcrumb level to info', () => {
      addBreadcrumb('some action');
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({ level: 'info' }),
      );
    });
  });

  // ── beforeSend privacy filter ────────────────────────────────────────────────
  describe('beforeSend privacy filter', () => {
    const getBeforeSend = () => {
      initSentry();
      const config = (Sentry.init as jest.Mock).mock.calls[0][0] as {
        beforeSend: (event: Record<string, unknown>) => Record<string, unknown>;
      };
      return config.beforeSend;
    };

    it('strips the Authorization header from the event request', () => {
      const beforeSend = getBeforeSend();
      const event = { request: { headers: { Authorization: 'Bearer secret-token' } } };
      const result = beforeSend(event);
      expect((result as typeof event).request.headers).not.toHaveProperty('Authorization');
    });

    it('strips the lowercase authorization header', () => {
      const beforeSend = getBeforeSend();
      const event = { request: { headers: { authorization: 'Bearer secret-token' } } };
      const result = beforeSend(event);
      expect((result as typeof event).request.headers).not.toHaveProperty('authorization');
    });

    it('returns the same event object reference (must not return null or a new object)', () => {
      const beforeSend = getBeforeSend();
      const event = { request: { headers: { Authorization: 'Bearer x' } } };
      // Returning null would silently drop the event from Sentry — guard against that.
      expect(beforeSend(event)).toBe(event);
    });

    it('returns the event unchanged when there are no request headers', () => {
      const beforeSend = getBeforeSend();
      const event = { message: 'crash without request' };
      expect(beforeSend(event)).toBe(event);
    });

    it('preserves non-sensitive headers', () => {
      const beforeSend = getBeforeSend();
      const event = {
        request: { headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' } },
      };
      const result = beforeSend(event) as typeof event;
      expect(result.request.headers['Content-Type']).toBe('application/json');
    });
  });

  // ── navigationIntegration export ─────────────────────────────────────────────
  describe('navigationIntegration', () => {
    it('is exported and has a registerNavigationContainer method', () => {
      expect(navigationIntegration).toBeDefined();
      expect(typeof navigationIntegration.registerNavigationContainer).toBe('function');
    });
  });
});
