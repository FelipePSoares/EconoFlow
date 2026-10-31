import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AppGate } from '../AppGate';

/**
 * `AppGate` owns the signed-out → signed-in transition. This suite wires a real Zustand
 * store into the app's `authStore` module and drives `setTokens` directly — exactly what
 * LoginScreen does after a successful login. The contract under test: writing the tokens
 * is enough, nothing has to navigate, and the tree swaps on its own.
 */

jest.mock('../../store/authStore', () => {
  const { create } = jest.requireActual('zustand');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const useAuthStore = create((set: (partial: Record<string, unknown>) => void) => ({
    isAuthenticated: false,
    needsOnboarding: false,
    accessToken: null,
    refreshToken: null,
    user: null,
    setTokens: (accessToken: string, refreshToken: string) =>
      set({ accessToken, refreshToken, isAuthenticated: true }),
    setUser: (user: { firstName?: string }) =>
      set({ user, isAuthenticated: true, needsOnboarding: !user.firstName }),
    // Mirrors the real store: only auth fields are reset, never the whole state object.
    clearAuth: () => set({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false }),
  }));

  // The real store hydrates from SecureStore on import; there is nothing to wait for in
  // a test that renders the component directly.
  useAuthStore.persist = {
    hasHydrated: () => true,
    onFinishHydration: () => () => {},
  } as unknown as typeof useAuthStore.persist;

  return { useAuthStore };
});

jest.mock('../AuthNavigator', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function AuthNavigator() {
    return React.createElement(Text, { testID: 'auth-navigator' }, 'Auth');
  }
  return { AuthNavigator };
});

jest.mock('../SessionNavigator', () => {
  const React = require('react');
  const { Text } = require('react-native');
  function SessionNavigator() {
    return React.createElement(Text, { testID: 'session-navigator' }, 'Session');
  }
  return { SessionNavigator };
});

type AuthApi = {
  getState: () => {
    setTokens: (a: string, r: string) => void;
    setUser: (u: { firstName?: string }) => void;
    clearAuth: () => void;
  };
};

// Read lazily: jest.mock hoisting means the module only exists once the test body runs.
const store = (): AuthApi =>
  (jest.requireMock('../../store/authStore') as { useAuthStore: AuthApi }).useAuthStore;

describe('AppGate', () => {
  // Reset the store *outside* `act`: with this preset, an `act()` that runs before
  // `render()` leaves the following tree empty. `render` already wraps its own act scope.
  beforeEach(() => {
    store().getState().clearAuth();
  });

  it('shows the auth stack while signed out', async () => {
    await render(<AppGate />);

    expect(screen.getByTestId('auth-navigator')).toBeTruthy();
    expect(screen.queryByTestId('session-navigator')).toBeNull();
  });

  it('swaps to the session navigator after setTokens', async () => {
    await render(<AppGate />);
    expect(screen.getByTestId('auth-navigator')).toBeTruthy();

    await act(async () => {
      store().getState().setTokens('at', 'rt');
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-navigator')).toBeTruthy();
    });
    expect(screen.queryByTestId('auth-navigator')).toBeNull();
  });

  it('swaps to the session navigator after setUser', async () => {
    await render(<AppGate />);

    await act(async () => {
      store().getState().setUser({ firstName: 'John' });
    });

    await waitFor(() => {
      expect(screen.getByTestId('session-navigator')).toBeTruthy();
    });
  });

  it('renders no session while the stored session is still being read (#1052)', async () => {
    // Rendering before the rehydration binds the account is what let a relaunch walk
    // straight past the unlock gate.
    const persistence = (jest.requireMock('../../store/authStore') as {
      useAuthStore: { persist: { hasHydrated: () => boolean } };
    }).useAuthStore.persist;
    const original = persistence.hasHydrated;
    persistence.hasHydrated = () => false;
    try {
      store().getState().setTokens('at', 'rt');

      await render(<AppGate />);

      expect(screen.queryByTestId('session-navigator')).toBeNull();
      expect(screen.queryByTestId('auth-navigator')).toBeNull();
    } finally {
      persistence.hasHydrated = original;
    }
  });

  it('returns to the auth stack when the auth state is cleared', async () => {
    await render(<AppGate />);

    await act(async () => {
      store().getState().setTokens('at', 'rt');
    });
    await waitFor(() => expect(screen.getByTestId('session-navigator')).toBeTruthy());

    await act(async () => {
      store().getState().clearAuth();
    });

    await waitFor(() => {
      expect(screen.getByTestId('auth-navigator')).toBeTruthy();
    });
  });
});
