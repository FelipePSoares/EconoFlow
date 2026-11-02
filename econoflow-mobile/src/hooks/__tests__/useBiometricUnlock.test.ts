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

  // A prompt the system takes away did not prove anything: the customer switching apps, or a
  // system screen covering it, must not spend one of the three attempts — otherwise a quick
  // switch-back drops them onto the keypad instead of asking again.
  it.each(['user_cancel', 'system_cancel', 'app_cancel', 'user_fallback'])(
    'does not count a %s as a failure',
    async (error) => {
      LocalAuthentication.authenticateAsync.mockResolvedValue(failure(error));
      const { result } = await renderHook(() => useBiometricUnlock(jest.fn(), { autoPrompt: false }));

      await act(async () => {
        await result.current.retry();
      });

      expect(result.current.failures).toBe(0);
      expect(result.current.exhausted).toBe(false);
    },
  );

  it('still counts a real refusal as a failure', async () => {
    LocalAuthentication.authenticateAsync.mockResolvedValue(failure('authentication_failed'));
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

  // #1116: `unavailable` means "this device cannot do biometrics", and the screens that
  // show the PIN treat it as final. A hardware check that fails or is still running is not
  // that: marking it made the next gate mount hand over to the keypad instead of the sensor.
  describe('a check that has not answered is not a device without biometrics (#1116)', () => {
    beforeEach(() => {
      // The native question is answered, slowly: this is a keychain/biometric-service round
      // trip, and on a cold start it can outlast the effect that opens the prompt.
      LocalAuthentication.hasHardwareAsync.mockImplementation(
        () => new Promise<boolean>(() => {}),
      );
    });

    it('stays undecided while the hardware check is in flight', async () => {
      const { result } = await renderHook(() =>
        useBiometricUnlock(jest.fn(), { autoPrompt: false }),
      );

      await flush();
      void result.current.prompt();
      await flush();

      expect(result.current.unavailable).toBe(false);
      expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    });

    it('does not mark the device unusable when the check rejects', async () => {
      LocalAuthentication.hasHardwareAsync.mockReset();
      LocalAuthentication.hasHardwareAsync.mockRejectedValue(new Error('not available'));
      const onUnlocked = jest.fn();
      const { result } = await renderHook(() =>
        useBiometricUnlock(onUnlocked, { autoPrompt: false }),
      );

      await act(async () => {
        await result.current.prompt();
      });

      // A sensor that refuses to answer is not "no sensor": the caller keeps the lock and
      // may ask again, and the user is not dropped onto the keypad.
      expect(result.current.unavailable).toBe(false);
      expect(onUnlocked).not.toHaveBeenCalled();
      expect(LocalAuthentication.authenticateAsync).not.toHaveBeenCalled();
    });

    it('does not mark the device unusable when the enrolment check rejects', async () => {
      LocalAuthentication.hasHardwareAsync.mockResolvedValue(true);
      LocalAuthentication.isEnrolledAsync.mockRejectedValue(new Error('not available'));
      const { result } = await renderHook(() =>
        useBiometricUnlock(jest.fn(), { autoPrompt: false }),
      );

      await act(async () => {
        await result.current.prompt();
      });

      expect(result.current.unavailable).toBe(false);
    });
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
