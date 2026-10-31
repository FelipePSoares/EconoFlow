import { renderHook, act } from '@testing-library/react-native';
import { useNotificationPermissionPrompt } from '../useNotificationPermissionPrompt';
import { useNotificationStore } from '../../store/notificationStore';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockRequestNotificationPermissionAndRegister = jest.fn();
jest.mock('../usePushNotifications', () => ({
  requestNotificationPermissionAndRegister: (...args: unknown[]) =>
    mockRequestNotificationPermissionAndRegister(...args),
}));

const resetStore = () => {
  useNotificationStore.setState({
    expoPushToken: null,
    notificationsEnabled: false,
    hasPromptedForPermission: false,
    pushPermissionStatus: 'undetermined',
    canAskForPermission: true,
    currentUserKey: null,
    signedInUserKey: null,
  });
};

describe('useNotificationPermissionPrompt (#1053)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    // Rehydration is a promise in production too; the flow only decides after it settles.
    useNotificationStore.setState({ hasHydrated: true });
    // A session always starts bound to the account that signed in (#1053).
    useNotificationStore.getState().bindSignedInUser('user-a');
    mockRequestNotificationPermissionAndRegister.mockResolvedValue({ ok: true });
  });

  it('runs the permission flow after the first authenticated screen mounts', async () => {
    const { rerender } = await renderHook(() => useNotificationPermissionPrompt());

    await act(async () => {
      rerender({});
    });

    expect(mockRequestNotificationPermissionAndRegister).toHaveBeenCalledTimes(1);
  });

  it('never runs the flow twice in the same session', async () => {
    const { rerender } = await renderHook(() => useNotificationPermissionPrompt());

    await act(async () => {
      rerender({});
    });
    await act(async () => {
      rerender({});
    });

    expect(mockRequestNotificationPermissionAndRegister).toHaveBeenCalledTimes(1);
  });

  it('waits for hydration before deciding, so a restart does not re-prompt', async () => {
    useNotificationStore.setState({ hasHydrated: false });
    const { rerender } = await renderHook(() => useNotificationPermissionPrompt());

    await act(async () => {
      rerender({});
    });
    expect(mockRequestNotificationPermissionAndRegister).not.toHaveBeenCalled();

    await act(async () => {
      useNotificationStore.setState({ hasPromptedForPermission: true, hasHydrated: true });
      rerender({});
    });

    // The stored answer was the user's; nothing is asked a second time on a restart.
    expect(mockRequestNotificationPermissionAndRegister).not.toHaveBeenCalled();
  });

  it('does not decide before the stored answer has been read', async () => {
    useNotificationStore.setState({ hasHydrated: false });
    const { result } = await renderHook(() => useNotificationPermissionPrompt());

    // `false` here only means "not read yet"; showing the rationale now would ask a user
    // who may already have answered.
    expect(result.current.shouldShowRationale).toBe(false);
  });

  it('does not re-open the rationale once the user answered', async () => {
    useNotificationStore.setState({ hasPromptedForPermission: true });

    const { result } = await renderHook(() => useNotificationPermissionPrompt());

    expect(result.current.shouldShowRationale).toBe(false);
  });

  it('exposes the result once the user answered the OS prompt', async () => {
    mockRequestNotificationPermissionAndRegister.mockImplementation(async () => {
      useNotificationStore.setState({
        hasPromptedForPermission: true,
        pushPermissionStatus: 'denied',
        canAskForPermission: false,
      });
      return { ok: false, reason: 'permission' };
    });

    const { result, rerender } = await renderHook(() => useNotificationPermissionPrompt());

    await act(async () => {
      rerender({});
    });

    expect(result.current.permissionDenied).toBe(true);
    expect(result.current.canAskForPermission).toBe(false);
  });

  it('exposes a dismiss action that silences the denied guidance', async () => {
    mockRequestNotificationPermissionAndRegister.mockImplementation(async () => {
      useNotificationStore.setState({
        hasPromptedForPermission: true,
        pushPermissionStatus: 'denied',
        canAskForPermission: false,
      });
      return { ok: false, reason: 'permission' };
    });

    const { result, rerender } = await renderHook(() => useNotificationPermissionPrompt());

    await act(async () => {
      rerender({});
    });
    await act(async () => {
      result.current.dismissPermissionDenied();
    });

    expect(result.current.permissionDenied).toBe(false);
  });

  // #1053: on a relaunch the account comes from the rehydrated auth store, while the
  // stored prompt answer is only written by an async SecureStore write. The two settle in
  // either order, and the flow used to fire on the first one — against an answer that
  // had not been read yet — so the rationale asked a user who had already answered.
  describe('when the app is relaunched for an account that already answered', () => {
    it('waits for the stored answer instead of prompting', async () => {
      useNotificationStore.setState({
        hasPromptedForPermission: false,
        currentUserKey: 'user-a',
        hasHydrated: false,
        signedInUserKey: 'user-a',
      });

      const { result, rerender } = await renderHook(() => useNotificationPermissionPrompt());

      await act(async () => {
        rerender({});
      });

      expect(result.current.shouldShowRationale).toBe(false);
      expect(mockRequestNotificationPermissionAndRegister).not.toHaveBeenCalled();
    });

    it('reads the stored answer when the notification store settles first', async () => {
      // The notification store is fully rehydrated (its answer is known) while the auth
      // store has not bound an account yet.
      useNotificationStore.setState({
        hasHydrated: true,
        currentUserKey: 'user-a',
        hasPromptedForPermission: true,
      });

      const { result } = await renderHook(() => useNotificationPermissionPrompt());

      expect(result.current.shouldShowRationale).toBe(false);
      expect(mockRequestNotificationPermissionAndRegister).not.toHaveBeenCalled();

      await act(async () => {
        // The rehydrated auth state lands and binds the account it already answered for.
        useNotificationStore.getState().bindSignedInUser('user-a');
      });

      expect(result.current.shouldShowRationale).toBe(false);
      expect(mockRequestNotificationPermissionAndRegister).not.toHaveBeenCalled();
    });

    it('still prompts a brand-new account on the same device', async () => {
      useNotificationStore.setState({
        hasHydrated: true,
        currentUserKey: 'user-a',
        hasPromptedForPermission: true,
      });

      const { result } = await renderHook(() => useNotificationPermissionPrompt());
      expect(mockRequestNotificationPermissionAndRegister).not.toHaveBeenCalled();

      await act(async () => {
        // A second account signs in on the same device and has never answered.
        useNotificationStore.getState().bindSignedInUser('user-b');
      });

      expect(result.current.shouldShowRationale).toBe(true);
      expect(mockRequestNotificationPermissionAndRegister).toHaveBeenCalledTimes(1);
    });

    it('runs the flow for an account that has never answered', async () => {
      useNotificationStore.getState().bindSignedInUser('user-b');

      const { result } = await renderHook(() => useNotificationPermissionPrompt());
      await act(async () => {});

      expect(mockRequestNotificationPermissionAndRegister).toHaveBeenCalledTimes(1);

      // Tapping the rationale then runs the same shared flow on top of it.
      await act(async () => {
        await result.current.request();
      });

      expect(mockRequestNotificationPermissionAndRegister).toHaveBeenCalledTimes(2);
      expect(result.current.shouldShowRationale).toBe(false);
    });
  });

  it('records the rationale answer in the account-bound store', async () => {
    useNotificationStore.setState({ currentUserKey: 'user-a', hasHydrated: true });
    useNotificationStore.getState().bindSignedInUser('user-a');

    const { result } = await renderHook(() => useNotificationPermissionPrompt());

    await act(async () => {
      result.current.dismissPermissionDenied();
    });

    expect(useNotificationStore.getState().hasPromptedForPermission).toBe(true);
    expect(result.current.shouldShowRationale).toBe(false);
  });

  it('is silent for a device the app knows is already activated', async () => {
    // Backgrounded and resumed, not killed: the registration is still alive, so there is
    // no activation to announce and nothing to ask (#1053).
    useNotificationStore.setState({
      hasHydrated: true,
      notificationsEnabled: true,
      expoPushToken: 'ExponentPushToken[abc]',
    });
    useNotificationStore.getState().bindSignedInUser('user-a');

    const { result } = await renderHook(() => useNotificationPermissionPrompt());
    await act(async () => {});

    expect(result.current.shouldShowRationale).toBe(false);
    expect(mockRequestNotificationPermissionAndRegister).not.toHaveBeenCalled();
    expect(useNotificationStore.getState().hasPromptedForPermission).toBe(true);
  });

  it('does not surface guidance when the permission was granted', async () => {
    mockRequestNotificationPermissionAndRegister.mockImplementation(async () => {
      useNotificationStore.setState({ hasPromptedForPermission: true, pushPermissionStatus: 'granted' });
      return { ok: true };
    });

    const { result, rerender } = await renderHook(() => useNotificationPermissionPrompt());

    await act(async () => {
      rerender({});
    });

    expect(result.current.permissionDenied).toBe(false);
    expect(result.current.shouldShowRationale).toBe(false);
  });
});
