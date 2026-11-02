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

// The two lock stores the session's first screen reads. The real ones are started by the
// auth store (a login forces a re-read of both), and `AppGate` holds the session tree until
// that read lands (#1116).
// Both stores' answer: `hasHydrated()` on the persistence object the gate asks. The stores
// themselves are Zustand stores (for the hook signature); their *values* never matter to
// the gate, which is about whether the answers are known, not what they say.
const mockBiometricPersist = { hasHydrated: jest.fn(() => true) };
const mockPinPersist = { hasHydrated: jest.fn(() => true) };

/** The listeners the gate registered through `subscribe*Answering`, so a test can fire them. */
const mockAnswerListeners = new Set<() => void>();

/** Says the stored answers are in, the way a finished read says it (#1116). */
const answerStoredReads = () => {
  mockPinPersist.hasHydrated.mockReturnValue(true);
  mockBiometricPersist.hasHydrated.mockReturnValue(true);
  act(() => {
    for (const listener of Array.from(mockAnswerListeners)) listener();
  });
};

const mockHydrateBiometricStore = jest.fn();
const mockHydratePinStore = jest.fn();
// Created inside the factories, which is where `zustand` itself is safe to load (the mock
// registry is in place once a factory runs). `AppGate` only reads these hooks — the state
// is a constant — so resetting the `jest.fn()`s elsewhere cannot change what the hooks
// answer, and a missing `hydrate*` call is impossible: the gate never calls them empty.
jest.mock('../../store/biometricStore', () => {
  const { create } = jest.requireActual('zustand');
  const useBiometricStore = create(() => ({ hydrated: true }));
  useBiometricStore.persist = mockBiometricPersist;
  return {
    useBiometricStore,
    hydrateBiometricStore: (...args: unknown[]) => mockHydrateBiometricStore(...args),
    subscribeBiometricAnswering: (listener: () => void) => {
      mockAnswerListeners.add(listener);
      return () => {
        mockAnswerListeners.delete(listener);
      };
    },
    isBiometricAnswerKnown: () => mockBiometricPersist.hasHydrated(),
  };
});

jest.mock('../../store/pinStore', () => {
  const { create } = jest.requireActual('zustand');
  const usePinStore = create(() => ({ hydrated: true }));
  usePinStore.persist = mockPinPersist;
  return {
    usePinStore,
    hydratePinStore: (...args: unknown[]) => mockHydratePinStore(...args),
    subscribePinAnswering: (listener: () => void) => {
      mockAnswerListeners.add(listener);
      return () => {
        mockAnswerListeners.delete(listener);
      };
    },
    isPinAnswerKnown: () => mockPinPersist.hasHydrated(),
  };
});

type AuthApi = {
  persist: { hasHydrated: () => boolean };
  getState: () => {
    setTokens: (a: string, r: string) => void;
    setUser: (u: { firstName?: string }) => void;
    clearAuth: () => void;
  };
};

// Read lazily: jest.mock hoisting means the module only exists once the test body runs.
const store = (): AuthApi =>
  (jest.requireMock('../../store/authStore') as { useAuthStore: AuthApi }).useAuthStore;

/**
 * Makes both lock stores' reads land, the way a SecureStore round trip eventually does.
 *
 * The hold the gate applies is driven by `hasHydrated()`, so the returned promise is only
 * what the gate subscribes to — this resolves it.
 */
const storeLockHydrated = (persistence: { hasHydrated: jest.Mock }): Promise<void> => {
  persistence.hasHydrated.mockReturnValue(true);
  return Promise.resolve();
};

describe('AppGate', () => {
  // Reset the store *outside* `act`: with this preset, an `act()` that runs before
  // `render()` leaves the following tree empty. `render` already wraps its own act scope.
  beforeEach(() => {
    store().getState().clearAuth();
    mockHydrateBiometricStore.mockReset();
    mockHydratePinStore.mockReset();
    mockBiometricPersist.hasHydrated.mockReturnValue(true);
    mockPinPersist.hasHydrated.mockReturnValue(true);
    mockHydratePinStore.mockImplementation(() => storeLockHydrated(mockPinPersist));
    mockHydrateBiometricStore.mockImplementation(() => storeLockHydrated(mockBiometricPersist));
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
    // straight past the unlock gate. The wait is a *screen*: a blank window is
    // indistinguishable from a hung app, which is the #1116 report.
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
      expect(screen.getByTestId('session-starting')).toBeTruthy();
    } finally {
      persistence.hasHydrated = original;
    }
  });

  // A login starts the lock stores' reads and the session tree appears in the same tick,
  // so the gate used to mount — and decide — over an unfinished read (#1116).
  describe('so the first screen of a session is never decided on defaults (#1116)', () => {
    it('does not hold a session that is already signed out of', async () => {
      // The hold belongs to a session; the signed-out tree decides nothing from the lock
      // stores and must never wait for them.
      mockPinPersist.hasHydrated.mockReturnValue(false);
      mockBiometricPersist.hasHydrated.mockReturnValue(false);

      await render(<AppGate />);

      expect(screen.getByTestId('auth-navigator')).toBeTruthy();
    });

    it('shows a starting screen, not a blank window, while the reads are on their way', async () => {
      // The defect #1116 describes: the activity is in front, the process is alive, and the
      // screen is white, so the only way out is restarting the app. A wait the customer can
      // see cannot be mistaken for a broken app — and it names which read is missing.
      mockPinPersist.hasHydrated.mockReturnValue(false);
      store().getState().setTokens('at', 'rt');

      await render(<AppGate />);

      expect(screen.getByTestId('session-starting')).toBeTruthy();
      expect(screen.queryByTestId('session-navigator')).toBeNull();
    });

    it('starts the reads itself, so a session that arrives without them still lands', async () => {
      // `setTokens` is only the token half of a login; the account half binds the stores.
      // The gate does not rely on that ordering: it asks for both reads when the session
      // appears, and joins the same hydration the auth store started.
      let finish: () => void = () => {};
      mockPinPersist.hasHydrated.mockReturnValue(false);
      mockHydratePinStore.mockImplementation(() =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
      );

      await render(<AppGate />);
      await act(async () => {
        store().getState().setTokens('at', 'rt');
      });

      expect(mockHydratePinStore).toHaveBeenCalled();
      expect(screen.queryByTestId('session-navigator')).toBeNull();

      // The read lands: it resolves, and the store tells the gate the answers are in.
      await act(async () => {
        finish();
        answerStoredReads();
      });

      await waitFor(() => {
        expect(screen.getByTestId('session-navigator')).toBeTruthy();
      });
    });

    it('holds a session until the lock stores have answered', async () => {
      mockPinPersist.hasHydrated.mockReturnValue(false);
      store().getState().setTokens('at', 'rt');

      await render(<AppGate />);

      expect(screen.queryByTestId('session-navigator')).toBeNull();
    });

    it('swaps the starting screen for the session when the answers land', async () => {
      mockPinPersist.hasHydrated.mockReturnValue(false);
      store().getState().setTokens('at', 'rt');

      await render(<AppGate />);
      expect(screen.getByTestId('session-starting')).toBeTruthy();

      await act(async () => {
        answerStoredReads();
      });

      await waitFor(() => {
        expect(screen.getByTestId('session-navigator')).toBeTruthy();
      });
      expect(screen.queryByTestId('session-starting')).toBeNull();
    });
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
