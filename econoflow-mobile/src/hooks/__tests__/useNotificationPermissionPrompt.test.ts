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
  });
};

describe('useNotificationPermissionPrompt (#1053)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStore();
    // Rehydration is a promise in production too; the flow only decides after it settles.
    useNotificationStore.setState({ hasHydrated: true });
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

    expect(mockRequestNotificationPermissionAndRegister).toHaveBeenCalledTimes(1);
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
