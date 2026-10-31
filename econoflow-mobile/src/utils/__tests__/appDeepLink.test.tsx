import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
import App from '../../../App';

/**
 * `App`'s wiring of the automation entry point (`econoflow://e2e/open`).
 *
 * The whole app is rendered — navigation, stores, screens — because the point of the entry
 * point is what the customer sees: the app decides its first screen from its stored state,
 * and this link is the one override the integration suite (`e2e/`) has. The assertions are
 * therefore about screens, not about listeners.
 */
let mockAuthState: {
  accessToken: string | null;
  refreshToken: string | null;
  user: { id: string; firstName: string } | null;
  isAuthenticated: boolean;
  needsOnboarding: boolean;
  openCreateProjectOnStart: boolean;
  setTokens: jest.Mock;
  setUser: jest.Mock;
  clearAuth: jest.Mock;
  setOpenCreateProjectOnStart: jest.Mock;
};

jest.mock('../../store/authStore', () => {
  const useAuthStore = (selector?: (s: typeof mockAuthState) => unknown) =>
    selector ? selector(mockAuthState) : mockAuthState;

  return {
    useAuthStore: Object.assign(useAuthStore, {
      getState: () => mockAuthState,
      setState: (patch: Partial<typeof mockAuthState>) => Object.assign(mockAuthState, patch),
      subscribe: () => () => undefined,
      persist: {
        hasHydrated: () => true,
        onFinishHydration: () => () => undefined,
        rehydrate: jest.fn(),
      },
    }),
  };
});

// The same query client the app imports, so the app and this test share one cache.
jest.mock('../../api/queryClient', () => {
  const { QueryClient } = jest.requireActual('@tanstack/react-query');
  return { queryClient: new QueryClient({ defaultOptions: { queries: { retry: false } } }) };
});

const mockLinkListeners: ((event: { url: string }) => void)[] = [];

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  __esModule: true,
  default: {
    openURL: jest.fn(),
    canOpenURL: jest.fn(),
    getInitialURL: jest.fn(async () => null),
    addEventListener: jest.fn((_event: string, listener: (event: { url: string }) => void) => {
      mockLinkListeners.push(listener);
      return { remove: jest.fn() };
    }),
    removeEventListener: jest.fn(),
  },
}));

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn(async () => undefined),
  hideAsync: jest.fn(async () => undefined),
}));

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

jest.mock('expo-linear-gradient', () => {
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  };
});

jest.mock('../../components/notifications/NotificationPermissionPrompt', () => ({
  NotificationPermissionPrompt: () => null,
}));

jest.mock('../../components/common/LockOverlay', () => ({
  LockOverlay: () => null,
}));

jest.mock('../../hooks/useAppLock', () => ({
  useAppLock: jest.fn(),
}));

const signedOut = () => ({
  accessToken: null,
  refreshToken: null,
  user: null,
  isAuthenticated: false,
  needsOnboarding: false,
  openCreateProjectOnStart: false,
  setTokens: jest.fn(),
  setUser: jest.fn(),
  clearAuth: jest.fn(),
  setOpenCreateProjectOnStart: jest.fn(),
});

describe('App – automation entry point', () => {
  beforeEach(() => {
    mockAuthState = signedOut();
    mockLinkListeners.length = 0;
  });

  it('shows the Login screen when the app is opened with the automation link', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByTestId('login-submit')).toBeTruthy());

    // The link reaches the app through React Native's Linking API.
    expect(mockLinkListeners.length).toBeGreaterThan(0);
    mockLinkListeners[0]({ url: 'econoflow://e2e/open' });

    // After the link the Login screen is what the customer sees.
    await waitFor(() => expect(screen.getByTestId('login-submit')).toBeTruthy());
  });

  it('never ends a restored session for the automation link', async () => {
    mockAuthState.isAuthenticated = true;

    render(<App />);

    await waitFor(() => expect(screen.queryByTestId('login-submit')).toBeNull());

    // The link decides the start screen only; a signed-in customer stays signed in.
    mockLinkListeners[0]({ url: 'econoflow://e2e/open' });
    await waitFor(() => expect(screen.queryByTestId('login-submit')).toBeNull());
  });
});
