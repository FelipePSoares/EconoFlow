import { act, renderHook } from '@testing-library/react-native';
import { useBiometricStore } from '../../store/biometricStore';
import { useBiometricToggle } from '../useBiometricToggle';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

const mockHydrateBiometricStore = jest.fn().mockResolvedValue(undefined);

jest.mock('../../store/biometricStore', () => {
  const actual = jest.requireActual('../../store/biometricStore');
  return {
    ...actual,
    // The one-shot read of the persisted value is a cold-start concern with its own
    // module-level state, tested in biometricStore.test.ts; here it only has to resolve.
    hydrateBiometricStore: () => mockHydrateBiometricStore(),
  };
});

const mockHasHardwareAsync = jest.fn();
const mockIsEnrolledAsync = jest.fn();

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: (...args: unknown[]) => mockHasHardwareAsync(...args),
  isEnrolledAsync: (...args: unknown[]) => mockIsEnrolledAsync(...args),
  authenticateAsync: jest.fn(),
  supportedBiometryTypes: jest.fn(),
  BiometryType: { Fingerprint: 1, FaceID: 2, Iris: 3 },
}));

/** Starts the store the way the app does: empty, ready for hydration. */
const resetStore = () => {
  useBiometricStore.setState({
    biometricEnabled: false,
    biometricPromptSkipped: false,
    hydrated: false,
  });
};

describe('useBiometricToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `clearAllMocks` drops the implementation too, so the one-shot hydration has to be
    // told to resolve again before the hook reads it.
    mockHydrateBiometricStore.mockResolvedValue(undefined);
    resetStore();
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
  });

  describe('enabling', () => {
    it('turns biometrics on in one call when hardware and enrolment are available', async () => {
      const { result } = await renderHook(() => useBiometricToggle());

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.setBiometricEnabled(true);
      });

      expect(outcome).toEqual({ ok: true });
      expect(useBiometricStore.getState().biometricEnabled).toBe(true);
    });

    // #1052: the decline is the *offer* answer and must survive. Clearing it here made the
    // next launch navigate "not enabled and never answered" → the enrollment offer again,
    // so the screen kept coming back. Enabling is done from Profile; the gate must only
    // ever prompt for the PIN after this.
    it('does not undo the declined enrollment offer', async () => {
      useBiometricStore.getState().setBiometricPromptSkipped();
      const { result } = await renderHook(() => useBiometricToggle());

      await act(async () => {
        await result.current.setBiometricEnabled(true);
      });

      expect(useBiometricStore.getState().biometricEnabled).toBe(true);
      expect(useBiometricStore.getState().biometricPromptSkipped).toBe(true);
    });

    it('turning biometrics off does not undo the declined enrollment offer either', async () => {
      useBiometricStore.getState().setBiometricPromptSkipped();
      const { result } = await renderHook(() => useBiometricToggle());

      await act(async () => {
        await result.current.setBiometricEnabled(false);
      });

      expect(useBiometricStore.getState().biometricPromptSkipped).toBe(true);
    });

    it('keeps the setting off and reports "hardware" when the device has no biometrics', async () => {
      mockHasHardwareAsync.mockResolvedValue(false);
      const { result } = await renderHook(() => useBiometricToggle());

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.setBiometricEnabled(true);
      });

      expect(outcome).toEqual({ ok: false, reason: 'hardware' });
      expect(useBiometricStore.getState().biometricEnabled).toBe(false);
      // No point asking whether anything is enrolled on hardware that cannot answer.
      expect(mockIsEnrolledAsync).not.toHaveBeenCalled();
    });

    it('keeps the setting off and reports "not-enrolled" when no biometric is enrolled', async () => {
      mockIsEnrolledAsync.mockResolvedValue(false);
      const { result } = await renderHook(() => useBiometricToggle());

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.setBiometricEnabled(true);
      });

      expect(outcome).toEqual({ ok: false, reason: 'not-enrolled' });
      expect(useBiometricStore.getState().biometricEnabled).toBe(false);
    });

    it('keeps the setting off and reports "unknown" when the hardware query throws', async () => {
      mockHasHardwareAsync.mockRejectedValue(new Error('native module missing'));
      const { result } = await renderHook(() => useBiometricToggle());

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.setBiometricEnabled(true);
      });

      expect(outcome).toEqual({ ok: false, reason: 'unknown' });
      expect(useBiometricStore.getState().biometricEnabled).toBe(false);
    });

    it('reports "unknown" when the enrolment query throws', async () => {
      mockIsEnrolledAsync.mockRejectedValue(new Error('keystore unavailable'));
      const { result } = await renderHook(() => useBiometricToggle());

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.setBiometricEnabled(true);
      });

      expect(outcome).toEqual({ ok: false, reason: 'unknown' });
      expect(useBiometricStore.getState().biometricEnabled).toBe(false);
    });
  });

  describe('disabling', () => {
    it('turns biometrics off without checking the hardware', async () => {
      useBiometricStore.setState({ biometricEnabled: true });
      const { result } = await renderHook(() => useBiometricToggle());

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.setBiometricEnabled(false);
      });

      expect(outcome).toEqual({ ok: true });
      expect(useBiometricStore.getState().biometricEnabled).toBe(false);
      // Turning the feature off must work even on a device whose sensors broke.
      expect(mockHasHardwareAsync).not.toHaveBeenCalled();
      expect(mockIsEnrolledAsync).not.toHaveBeenCalled();
    });
  });

  describe('double taps', () => {
    it('toggles exactly once when two taps arrive before the first check resolves', async () => {
      let releaseEnrolment: (value: boolean) => void = () => {};
      mockIsEnrolledAsync.mockImplementation(
        () => new Promise<boolean>((resolve) => { releaseEnrolment = resolve; }),
      );
      const { result } = await renderHook(() => useBiometricToggle());

      let firstCall: Promise<unknown> = Promise.resolve();
      let secondCall: Promise<unknown> = Promise.resolve();
      // Both taps are made before the first check answers, exactly as a double tap would.
      await act(async () => {
        firstCall = result.current.setBiometricEnabled(true);
        secondCall = result.current.setBiometricEnabled(true);
      });

      releaseEnrolment(true);
      let first: unknown;
      let second: unknown;
      await act(async () => {
        [first, second] = await Promise.all([firstCall, secondCall]);
      });

      // The second tap joins the first request instead of starting a second check, so
      // the row cannot be flipped twice by one double tap.
      expect(mockHasHardwareAsync).toHaveBeenCalledTimes(1);
      expect(first).toEqual({ ok: true });
      expect(second).toEqual({ ok: true });
      expect(useBiometricStore.getState().biometricEnabled).toBe(true);
    });

    it('ignores taps until the persisted state has finished hydrating', async () => {
      mockHydrateBiometricStore.mockReturnValue(new Promise(() => {}));
      useBiometricStore.setState({ hydrated: false });
      const { result } = await renderHook(() => useBiometricToggle());

      let outcome: unknown;
      await act(async () => {
        outcome = await result.current.setBiometricEnabled(true);
      });

      // Applying a change over an unhydrated value is exactly what the replayed
      // persisted state used to overwrite (#1052), so the tap is dropped and the row
      // is told it is disabled.
      expect(outcome).toEqual({ ok: false, reason: 'not-hydrated' });
      expect(mockHasHardwareAsync).not.toHaveBeenCalled();
      expect(useBiometricStore.getState().biometricEnabled).toBe(false);
    });

    it('accepts taps once hydration has finished', async () => {
      const { result } = await renderHook(() => useBiometricToggle());

      await act(async () => {
        await result.current.setBiometricEnabled(true);
      });

      expect(useBiometricStore.getState().biometricEnabled).toBe(true);
    });
  });

  it('exposes whether the row may be tapped yet', async () => {
    mockHydrateBiometricStore.mockReturnValue(new Promise(() => {}));
    useBiometricStore.setState({ hydrated: false });
    const { result } = await renderHook(() => useBiometricToggle());

    expect(result.current.enabled).toBe(false);
    expect(result.current.isHydrated).toBe(false);

    await act(async () => {
      useBiometricStore.setState({ hydrated: true });
    });

    expect(result.current.enabled).toBe(true);
    expect(result.current.isHydrated).toBe(true);
  });

  it('marks the row busy while the check is in flight', async () => {
    let releaseEnrolment: (value: boolean) => void = () => {};
    mockIsEnrolledAsync.mockImplementation(
      () => new Promise<boolean>((resolve) => { releaseEnrolment = resolve; }),
    );
    const { result } = await renderHook(() => useBiometricToggle());

    let pending: Promise<unknown> = Promise.resolve();
    await act(async () => {
      pending = result.current.setBiometricEnabled(true);
    });

    expect(result.current.isPending).toBe(true);
    expect(result.current.enabled).toBe(false);

    releaseEnrolment(true);
    await act(async () => {
      await pending;
    });

    expect(result.current.isPending).toBe(false);
    expect(result.current.enabled).toBe(true);
  });
});
