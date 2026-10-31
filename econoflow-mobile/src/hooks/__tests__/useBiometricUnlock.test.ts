import { act, renderHook } from '@testing-library/react-native';
import { useBiometricUnlock, MAX_BIOMETRIC_FAILURES } from '../useBiometricUnlock';

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(),
  isEnrolledAsync: jest.fn(),
  authenticateAsync: jest.fn(),
}));
const LocalAuthentication = jest.requireMock('expo-local-authentication') as {
  hasHardwareAsync: jest.Mock;
  isEnrolledAsync: jest.Mock;
  authenticateAsync: jest.Mock;
};

jest.mock('../../store/biometricStore', () => ({
  useBiometricStore: (selector: (s: { biometricEnabled: boolean }) => unknown) =>
    selector({ biometricEnabled: true }),
}));

const failure = (error: string) => ({ success: false, error });

/** Flushes the microtasks a prompt's native round trip leaves behind. */
const flush = async () => {
  await act(async () => {});
};

describe('useBiometricUnlock (#1052)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    LocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
    LocalAuthentication.isEnrolledAsync.mockResolvedValue(true);
    LocalAuthentication.authenticateAsync.mockResolvedValue({ success: true });
  });

  /**
   * Every case below drives the prompt through `retry()` / `prompt()`, which run
   * deterministically inside `act`. The *automatic* first prompt is covered by the screen
   * suites (`BiometricGateScreen`, `PinEntryScreen`), where the effect and its deferral
   * run as they do in the app.
   */
  it('opens one prompt at a time and unlocks on success', async () => {
    const onUnlocked = jest.fn();
    const { result } = await renderHook(() =>
      useBiometricUnlock(onUnlocked, { autoPrompt: false }),
    );

    await act(async () => {
      await result.current.retry();
    });

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(onUnlocked).toHaveBeenCalledTimes(1);
    expect(result.current.exhausted).toBe(false);
  });

  it(`hands over to the PIN after ${MAX_BIOMETRIC_FAILURES} failures`, async () => {
    const onUnlocked = jest.fn();
    LocalAuthentication.authenticateAsync.mockResolvedValue(failure('authentication_failed'));
    const { result } = await renderHook(() =>
      useBiometricUnlock(onUnlocked, { autoPrompt: false }),
    );

    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.failures).toBe(1);
    expect(result.current.exhausted).toBe(false);

    await act(async () => {
      await result.current.retry();
    });
    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.failures).toBe(MAX_BIOMETRIC_FAILURES);
    expect(result.current.exhausted).toBe(true);
    expect(onUnlocked).not.toHaveBeenCalled();
  });

  it('stops prompting on its own once exhausted, so the PIN is the only way in', async () => {
    const onUnlocked = jest.fn();
    LocalAuthentication.authenticateAsync.mockResolvedValue(failure('authentication_failed'));
    const { result } = await renderHook(() =>
      useBiometricUnlock(onUnlocked, { autoPrompt: false }),
    );

    for (let i = 0; i < MAX_BIOMETRIC_FAILURES; i += 1) {
      await act(async () => {
        await result.current.retry();
      });
    }
    expect(result.current.exhausted).toBe(true);

    // A third automatic prompt would loop the user; only an explicit retry may open one.
    await act(async () => {
      await result.current.prompt();
    });

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(MAX_BIOMETRIC_FAILURES);
  });

  it('counts a user cancellation as a failure', async () => {
    LocalAuthentication.authenticateAsync.mockResolvedValue(failure('user_cancel'));
    const { result } = await renderHook(() => useBiometricUnlock(jest.fn(), { autoPrompt: false }));

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.failures).toBe(1);
  });

  it('counts lockout as a failure and says so', async () => {
    LocalAuthentication.authenticateAsync.mockResolvedValue(failure('lockout'));
    const { result } = await renderHook(() => useBiometricUnlock(jest.fn(), { autoPrompt: false }));

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.lockedOut).toBe(true);
    expect(result.current.failures).toBe(1);
  });

  it('clears the lockout on a new attempt', async () => {
    LocalAuthentication.authenticateAsync
      .mockResolvedValueOnce(failure('lockout'))
      .mockResolvedValueOnce({ success: true });
    const { result } = await renderHook(() => useBiometricUnlock(jest.fn(), { autoPrompt: false }));

    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.lockedOut).toBe(true);

    await act(async () => {
      await result.current.retry();
    });

    expect(result.current.lockedOut).toBe(false);
  });

  it('skips the prompt without using an attempt when the device cannot do biometrics', async () => {
    LocalAuthentication.hasHardwareAsync.mockResolvedValue(false);
    const { result } = await renderHook(() => useBiometricUnlock(jest.fn(), { autoPrompt: false }));

    await act(async () => {
      await result.current.retry();
    });

    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    expect(result.current.unavailable).toBe(true);
    expect(result.current.failures).toBe(0);
  });

  it('skips the prompt when nothing is enrolled', async () => {
    LocalAuthentication.isEnrolledAsync.mockResolvedValue(false);
    const { result } = await renderHook(() => useBiometricUnlock(jest.fn(), { autoPrompt: false }));

    await act(async () => {
      await result.current.retry();
    });

    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    expect(result.current.unavailable).toBe(true);
  });

  it('never prompts on its own on a screen that shows the PIN (#1052)', async () => {
    const onUnlocked = jest.fn();
    const { result } = await renderHook(() =>
      useBiometricUnlock(onUnlocked, { autoPrompt: false }),
    );

    await flush();
    await flush();

    expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    expect(onUnlocked).not.toHaveBeenCalled();

    // Only an explicit request opens the prompt.
    await act(async () => {
      await result.current.retry();
    });

    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledTimes(1);
    expect(onUnlocked).toHaveBeenCalled();
  });

  it('does not offer the PIN before the failures run out when the caller says so', async () => {
    const { result } = await renderHook(() =>
      useBiometricUnlock(jest.fn(), { escapeAvailable: false, autoPrompt: false }),
    );

    expect(result.current.canUsePin).toBe(false);
    expect(result.current.exhausted).toBe(false);
  });

  it('offers the PIN as soon as the failures run out, even without an escape', async () => {
    LocalAuthentication.authenticateAsync.mockResolvedValue(failure('authentication_failed'));
    const { result } = await renderHook(() =>
      useBiometricUnlock(jest.fn(), { escapeAvailable: false, autoPrompt: false }),
    );

    for (let i = 0; i < MAX_BIOMETRIC_FAILURES; i += 1) {
      await act(async () => {
        await result.current.retry();
      });
    }

    expect(result.current.exhausted).toBe(true);
    expect(result.current.canUsePin).toBe(true);
  });
});
