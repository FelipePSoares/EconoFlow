// All imports first — Jest hoists jest.mock() calls before any imports at
// runtime regardless of their position in source, so this ordering is safe.
import { useAuthStore } from '../authStore';
import { setUserContext, clearUserContext } from '../../monitoring/sentry';
import type { User } from '../../api/types';
import type { AuthState } from '../authStore';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../monitoring/sentry', () => ({
  setUserContext: jest.fn(),
  clearUserContext: jest.fn(),
}));

const mockUser: User = {
  id: 'user-abc-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  fullName: 'Test User',
  enabled: true,
  isFirstLogin: false,
  emailConfirmed: true,
  twoFactorEnabled: false,
  defaultProjectId: null,
  notificationChannels: [],
  languageCode: 'en',
  isBetaTester: false,
};

// Retrieve the inner rehydration handler from the persist config.
// The outer function ignores its argument (pre-rehydration state) and
// returns the inner callback that receives the post-rehydration state.
const getRehydrationCallback = (): ((state: AuthState | undefined) => void) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const options = (useAuthStore as any).persist.getOptions() as {
    onRehydrateStorage: () => (state: AuthState | undefined) => void;
  };
  return options.onRehydrateStorage();
};

describe('authStore – needsOnboarding derived value', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
  });

  it('is false when user is null', () => {
    expect(useAuthStore.getState().needsOnboarding).toBe(false);
  });

  it('is true when user has no firstName', () => {
    useAuthStore.getState().setUser({ ...mockUser, firstName: '' });
    expect(useAuthStore.getState().needsOnboarding).toBe(true);
  });

  it('is false when user has a firstName', () => {
    useAuthStore.getState().setUser({ ...mockUser, firstName: 'Alice' });
    expect(useAuthStore.getState().needsOnboarding).toBe(false);
  });

  it('becomes false after clearAuth', () => {
    useAuthStore.getState().setUser({ ...mockUser, firstName: '' });
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().needsOnboarding).toBe(false);
  });
});

describe('authStore – Sentry user context integration', () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
    });
    jest.clearAllMocks();
  });

  // ── setUser ──────────────────────────────────────────────────────────────────
  describe('setUser', () => {
    it('calls setUserContext with the user id', () => {
      useAuthStore.getState().setUser(mockUser);
      expect(setUserContext).toHaveBeenCalledWith('user-abc-123');
    });

    it('calls setUserContext exactly once per setUser call', () => {
      useAuthStore.getState().setUser(mockUser);
      expect(setUserContext).toHaveBeenCalledTimes(1);
    });

    it('does not pass email to setUserContext (PII hygiene)', () => {
      useAuthStore.getState().setUser(mockUser);
      const callArg = (setUserContext as jest.Mock).mock.calls[0][0] as string;
      expect(callArg).not.toContain('@');
    });

    it('persists the user object in the store', () => {
      useAuthStore.getState().setUser(mockUser);
      expect(useAuthStore.getState().user).toEqual(mockUser);
    });
  });

  // ── clearAuth ────────────────────────────────────────────────────────────────
  describe('clearAuth', () => {
    it('calls clearUserContext', () => {
      useAuthStore.getState().clearAuth();
      expect(clearUserContext).toHaveBeenCalledTimes(1);
    });

    it('clears all auth state from the store', () => {
      useAuthStore.setState({ accessToken: 'tok', refreshToken: 'ref', isAuthenticated: true });
      useAuthStore.getState().clearAuth();
      const { accessToken, refreshToken, isAuthenticated, user } = useAuthStore.getState();
      expect(accessToken).toBeNull();
      expect(refreshToken).toBeNull();
      expect(isAuthenticated).toBe(false);
      expect(user).toBeNull();
    });
  });

  // ── setTokens ────────────────────────────────────────────────────────────────
  describe('setTokens', () => {
    it('does not call setUserContext (user context is set only on setUser)', () => {
      useAuthStore.getState().setTokens('access-tok', 'refresh-tok');
      expect(setUserContext).not.toHaveBeenCalled();
    });
  });

  // ── onRehydrateStorage callback ───────────────────────────────────────────────
  describe('onRehydrateStorage callback', () => {
    it('calls setUserContext with the user id when the rehydrated state has a user', () => {
      const rehydrate = getRehydrationCallback();
      rehydrate({ ...useAuthStore.getState(), user: { ...mockUser, id: 'uid-rehydrated' } });
      expect(setUserContext).toHaveBeenCalledWith('uid-rehydrated');
    });

    it('does not call setUserContext when the rehydrated state is undefined (error path)', () => {
      const rehydrate = getRehydrationCallback();
      rehydrate(undefined);
      expect(setUserContext).not.toHaveBeenCalled();
    });

    it('does not call setUserContext when the rehydrated state has a null user', () => {
      const rehydrate = getRehydrationCallback();
      rehydrate({ ...useAuthStore.getState(), user: null });
      expect(setUserContext).not.toHaveBeenCalled();
    });
  });
});

describe('authStore – partialize (persistence shape)', () => {
  it('does not persist needsOnboarding (recomputed from user on rehydration)', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { partialize } = (useAuthStore as any).persist.getOptions() as {
      partialize: (s: AuthState) => Record<string, unknown>;
    };
    const partial = partialize({ ...useAuthStore.getState(), needsOnboarding: true, openCreateProjectOnStart: true });
    expect(partial).not.toHaveProperty('needsOnboarding');
    expect(partial).not.toHaveProperty('openCreateProjectOnStart');
  });
});

describe('authStore – openCreateProjectOnStart flag', () => {
  beforeEach(() => {
    useAuthStore.setState({ openCreateProjectOnStart: false });
  });

  it('defaults to false', () => {
    expect(useAuthStore.getState().openCreateProjectOnStart).toBe(false);
  });

  it('setOpenCreateProjectOnStart(true) sets it to true', () => {
    useAuthStore.getState().setOpenCreateProjectOnStart(true);
    expect(useAuthStore.getState().openCreateProjectOnStart).toBe(true);
  });

  it('setOpenCreateProjectOnStart(false) resets it', () => {
    useAuthStore.getState().setOpenCreateProjectOnStart(true);
    useAuthStore.getState().setOpenCreateProjectOnStart(false);
    expect(useAuthStore.getState().openCreateProjectOnStart).toBe(false);
  });

  it('clearAuth resets openCreateProjectOnStart to false', () => {
    useAuthStore.getState().setOpenCreateProjectOnStart(true);
    useAuthStore.getState().clearAuth();
    expect(useAuthStore.getState().openCreateProjectOnStart).toBe(false);
  });
});
