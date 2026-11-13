// All imports first — Jest hoists jest.mock() calls before any imports at
// runtime regardless of their position in source, so this ordering is safe.
import axios from 'axios';
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

jest.mock('../../store/projectStore', () => ({
  useProjectStore: {
    getState: jest.fn().mockReturnValue({
      clearProject: jest.fn(),
    }),
  },
}));

jest.mock('../queryClient', () => ({
  queryClient: { clear: jest.fn() },
}));

/**
 * Whether a lock screen is in front. A 401 whose refresh fails must not end the session while
 * one is (see the two tests at the end of this file), so the interceptor asks this.
 */
const mockLockScreenVisible = jest.fn().mockReturnValue(false);

jest.mock('../../navigation/sessionRoute', () => ({
  isSessionOnUnlockScreen: () => mockLockScreenVisible(),
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAuthStoreMock = () => (jest.requireMock('../../store/authStore') as any).useAuthStore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getProjectStoreMock = () => (jest.requireMock('../../store/projectStore') as any).useProjectStore;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getQueryClientMock = () => (jest.requireMock('../queryClient') as any).queryClient;

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
  });

  it('sets X-Client-Type header to mobile on every request', async () => {
    const adapter: AnyAdapter = jest.fn().mockResolvedValue({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { url: '/api/test', method: 'get', headers: {} },
      request: {},
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = adapter;
    await apiClient.get('/api/test');
    const [config] = adapter.mock.calls[0] as [{ headers: Record<string, string> }];
    expect(config.headers['X-Client-Type']).toBe('mobile');
  });

  it('sets Accept-Language header from i18n language on every request', async () => {
    const adapter: AnyAdapter = jest.fn().mockResolvedValue({
      data: {},
      status: 200,
      statusText: 'OK',
      headers: {},
      config: { url: '/api/test', method: 'get', headers: {} },
      request: {},
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = adapter;
    await apiClient.get('/api/test');
    const [config] = adapter.mock.calls[0] as [{ headers: Record<string, string> }];
    expect(config.headers['Accept-Language']).toBe('en');
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

describe('apiClient interceptors – auto-logout data cleanup', () => {
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
    getAuthStoreMock().getState.mockReturnValue({
      accessToken: null,
      refreshToken: null,
      setTokens: jest.fn(),
      clearAuth: jest.fn(),
    });
    getProjectStoreMock().getState.mockReturnValue({ clearProject: jest.fn() });
  });

  it('clears the React Query cache on 401 when there is no refresh token', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = errorAdapter(401, '/api/categories');
    getAuthStoreMock().getState.mockReturnValue({
      accessToken: 'tok',
      refreshToken: null,
      setTokens: jest.fn(),
      clearAuth: jest.fn(),
    });

    await expect(apiClient.get('/api/categories')).rejects.toBeDefined();

    expect(getQueryClientMock().clear).toHaveBeenCalledTimes(1);
  });

  it('clears the React Query cache before clearAuth on the no-refresh-token path', async () => {
    const callOrder: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = errorAdapter(401, '/api/categories');
    const mockClearAuth = jest.fn(() => { callOrder.push('clearAuth'); });
    getAuthStoreMock().getState.mockReturnValue({
      accessToken: 'tok',
      refreshToken: null,
      setTokens: jest.fn(),
      clearAuth: mockClearAuth,
    });
    getQueryClientMock().clear.mockImplementation(() => { callOrder.push('queryClient.clear'); });

    await expect(apiClient.get('/api/categories')).rejects.toBeDefined();

    expect(callOrder).toEqual(['queryClient.clear', 'clearAuth']);
  });

  it('clears the React Query cache when the token refresh request fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = errorAdapter(401, '/api/expenses');
    getAuthStoreMock().getState.mockReturnValue({
      accessToken: 'old-tok',
      refreshToken: 'old-refresh',
      setTokens: jest.fn(),
      clearAuth: jest.fn(),
    });
    jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Refresh failed'));

    await expect(apiClient.get('/api/expenses')).rejects.toBeDefined();

    expect(getQueryClientMock().clear).toHaveBeenCalledTimes(1);
  });

  it('clears clearProject on 401 when there is no refresh token', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = errorAdapter(401, '/api/categories');
    const mockClearProject = jest.fn();
    getAuthStoreMock().getState.mockReturnValue({
      accessToken: 'tok',
      refreshToken: null,
      setTokens: jest.fn(),
      clearAuth: jest.fn(),
    });
    getProjectStoreMock().getState.mockReturnValue({ clearProject: mockClearProject });

    await expect(apiClient.get('/api/categories')).rejects.toBeDefined();

    expect(mockClearProject).toHaveBeenCalledTimes(1);
  });

  it('clears clearProject when the token refresh request fails', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = errorAdapter(401, '/api/expenses');
    const mockClearProject = jest.fn();
    getAuthStoreMock().getState.mockReturnValue({
      accessToken: 'old-tok',
      refreshToken: 'old-refresh',
      setTokens: jest.fn(),
      clearAuth: jest.fn(),
    });
    getProjectStoreMock().getState.mockReturnValue({ clearProject: mockClearProject });
    jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Refresh failed'));

    await expect(apiClient.get('/api/expenses')).rejects.toBeDefined();

    expect(mockClearProject).toHaveBeenCalledTimes(1);
  });

  /**
   * A failed refresh must not sign the customer out while a lock screen is in front (#1116).
   *
   * The mobile suite's restart cases showed why: on a relaunch the app opens the biometric gate,
   * the gate asks the sensor, and a background request 401s meanwhile. Its refresh is refused,
   * the interceptor calls `clearAuth()`, and the session is destroyed under the still-open
   * sensor dialog - the gate unmounts and nothing reaches the app. In the trail:
   *
   *   biometric.prompt.requested
   *   auth.clear
   *   biometric.prompt.skipped {`reason`:`stale`,`mounted`:false}
   *
   * The unlock screens are the app's own "you are still signed in, prove you are the customer"
   * state, so nothing in the background may end that session. The request still fails for its
   * caller; the session is left for the unlock to finish.
   */
  it('does not clear the session when a refresh fails while a lock screen is in front', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = errorAdapter(401, '/api/expenses');
    const clearAuth = jest.fn();
    getAuthStoreMock().getState.mockReturnValue({
      accessToken: 'old-tok',
      refreshToken: 'old-refresh',
      setTokens: jest.fn(),
      clearAuth,
    });
    jest.spyOn(axios, 'post').mockRejectedValueOnce(new Error('Refresh failed'));
    mockLockScreenVisible.mockReturnValue(true);

    await expect(apiClient.get('/api/expenses')).rejects.toBeDefined();

    expect(clearAuth).not.toHaveBeenCalled();
    mockLockScreenVisible.mockReturnValue(false);
  });

  it('does not clear the session when there is no refresh token while a lock screen is in front', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (apiClient.defaults as any).adapter = errorAdapter(401, '/api/categories');
    const clearAuth = jest.fn();
    getAuthStoreMock().getState.mockReturnValue({
      accessToken: 'tok',
      refreshToken: null,
      setTokens: jest.fn(),
      clearAuth,
    });
    mockLockScreenVisible.mockReturnValue(true);

    await expect(apiClient.get('/api/categories')).rejects.toBeDefined();

    expect(clearAuth).not.toHaveBeenCalled();
    mockLockScreenVisible.mockReturnValue(false);
  });
});
