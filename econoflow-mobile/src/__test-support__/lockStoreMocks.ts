/**
 * The two lock stores `BiometricGateScreen` decides from, as Jest module mocks.
 *
 * `BiometricGateScreen`'s three test files load this module from inside their `jest.mock`
 * factories (`jest.requireActual`) — a factory may only reach into other modules, and an
 * object literal naming a `mock…` identifier would be read as the proxy for a mock of that
 * name — and read it from there as well.
 *
 * Calling `useBiometricStore` with a selector answers from `mockLockStores.current`, so a
 * case moves the device by assigning that object and re-rendering. The functions read it on
 * **every call**: capturing it once, or building them so `jest.clearAllMocks()` wipes their
 * body, is how a pending read became impossible to script. The two hooks are plain
 * functions (not `jest.fn()`s) for the same reason — jest's call records are not the answer.
 */

export type BiometricStoreState = {
  biometricEnabled: boolean;
  biometricPromptSkipped: boolean;
  hydrated: boolean;
  setBiometricEnabled: () => void;
};

export type PinStoreState = { hasPin: boolean; hydrated: boolean };

export type LockStores = {
  biometric: BiometricStoreState;
  /** Whether the stored biometric answer has been read (`persist.hasHydrated()`). */
  biometricAnswerKnown: boolean;
  pin: PinStoreState;
  /** Whether the stored PIN has been read. */
  pinAnswerKnown: boolean;
};

/** Biometrics on, enrolled, a PIN on the device, both answers read: the steady session. */
export const defaultLockStores = (): LockStores => ({
  biometric: {
    biometricEnabled: true,
    biometricPromptSkipped: false,
    hydrated: true,
    setBiometricEnabled: jest.fn(),
  },
  biometricAnswerKnown: true,
  pin: { hasPin: true, hydrated: true },
  pinAnswerKnown: true,
});

export const mockLockStores: { current: LockStores } = { current: defaultLockStores() };

/** Whether the scripted device has a biometric enrolled (the native answer). */
export const mockDeviceEnrolled = { current: true };

/**
 * Selector-aware, like the real hooks: a mock that ignored the selector would hand the
 * whole state to `useSelector`-style calls and silently break every consumer. The state is
 * read on **every call** — capturing it once would freeze the first case's device for the
 * whole file.
 *
 * Plain functions, not `jest.fn()`s: a case that answers a pending read re-renders, and
 * React reads the hook from the render it commits — always the latest one. A call record
 * kept by jest only says how often it was asked, and a stale answer is exactly what these
 * suites are about.
 */
export const useBiometricStore = (selector?: (s: BiometricStoreState) => unknown) => {
  const state = mockLockStores.current.biometric;
  return selector ? selector(state) : state;
};

Object.assign(useBiometricStore, {
  persist: { hasHydrated: () => mockLockStores.current.biometricAnswerKnown },
});

export const usePinStore = (selector?: (s: PinStoreState) => unknown) => {
  const state = mockLockStores.current.pin;
  return selector ? selector(state) : state;
};

Object.assign(usePinStore, {
  persist: { hasHydrated: () => mockLockStores.current.pinAnswerKnown },
});

// The same rule as the hooks above: plain functions, so a pending read is answered by
// whatever `mockLockStores.current` says at the render that asks — and every caller of
// these can be stubbed, because they are already Jest mock functions.
export const subscribeBiometricAnswering = jest.fn(() => () => {});
export const subscribePinAnswering = jest.fn(() => () => {});
export const isBiometricAnswerKnown = jest.fn(() => mockLockStores.current.biometricAnswerKnown);
export const isPinAnswerKnown = jest.fn(() => mockLockStores.current.pinAnswerKnown);
export const hydrateBiometricStore = jest.fn(() => Promise.resolve());
export const hydratePinStore = jest.fn(() => Promise.resolve());
