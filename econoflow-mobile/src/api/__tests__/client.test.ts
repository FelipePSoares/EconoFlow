// All imports first — Jest hoists jest.mock() calls before any imports at
// runtime regardless of their position in source, so this ordering is safe.
import { apiClient } from '../client';
import { addBreadcrumb } from '../../monitoring/sentry';

jest.mock('../../monitoring/sentry', () => ({
  addBreadcrumb: jest.fn(),
}));

jest.mock('../../store/authStore', () => ({
  useAuthStore: {
    getState: jest.fn().mockReturnValue({
      accessToken: null,
      refreshToken: null,
      setTokens: jest.fn(),
      clearAuth: jest.fn(),
    }),
  },
}));

jest.mock('../../i18n', () => ({
  __esModule: true,
  default: { language: 'en' },
}));

// ---------------------------------------------------------------------------
// Minimal axios adapter helpers
// ---------------------------------------------------------------------------
type AnyAdapter = jest.Mock;

const successAdapter = (url = '/api/test'): AnyAdapter =>
  jest.fn().mockResolvedValue({
    data: {},
    status: 200,
    statusText: 'OK',
    headers: {},
    config: { url, method: 'get', headers: {} },
    request: {},
  });

const errorAdapter = (status: number, url = '/api/test'): AnyAdapter =>
  jest.fn().mockRejectedValue(
    Object.assign(new Error(`Request failed with status code ${status}`), {
      isAxiosError: true,
      response: { status, data: {}, headers: {}, statusText: 'Error' },
      config: { url, method: 'get', headers: {} },
    }),
  );

describe('apiClient interceptors – Accept-Language header', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let savedAdapter: any;

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    savedAdapter = (apiClient.defaults as any).adapter;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = savedAdapter;
    jest.clearAllMocks();
  });

  it('adds Accept-Language header derived from i18n.language to every request', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let capturedConfig: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = (config: any) => {
      capturedConfig = config;
      return Promise.resolve({
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
        request: {},
      });
    };

    await apiClient.get('/api/test');

    expect(capturedConfig?.headers?.['Accept-Language']).toBe('en');
  });
});

describe('apiClient interceptors – Sentry breadcrumbs', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let savedAdapter: any;

  beforeAll(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    savedAdapter = (apiClient.defaults as any).adapter;
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = savedAdapter;
    jest.clearAllMocks();
  });

  it('adds an http breadcrumb for every outgoing request', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = successAdapter('/api/projects');
    await apiClient.get('/api/projects');

    expect(addBreadcrumb).toHaveBeenCalledWith(
      'GET /api/projects',
      'http',
      expect.objectContaining({ method: 'GET', url: '/api/projects' }),
    );
  });

  it('adds an error breadcrumb for non-401 HTTP errors', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = errorAdapter(500, '/api/projects');
    await expect(apiClient.get('/api/projects')).rejects.toBeDefined();

    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.stringContaining('500'),
      'http',
      expect.objectContaining({ status: 500 }),
    );
  });

  it('does not add an error breadcrumb for initial 401 responses (token refresh path)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = errorAdapter(401, '/api/categories');
    // The 401 handler runs; since refreshToken is null it calls clearAuth
    await expect(apiClient.get('/api/categories')).rejects.toBeDefined();

    // addBreadcrumb is called for the outgoing request but NOT for the 401 error
    const calls = (addBreadcrumb as jest.Mock).mock.calls as [string, string][];
    const errorCrumbs = calls.filter(([msg]) => msg.includes('401'));
    expect(errorCrumbs).toHaveLength(0);
  });
});
