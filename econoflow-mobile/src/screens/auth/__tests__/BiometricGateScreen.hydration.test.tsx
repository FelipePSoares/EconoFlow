import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import { BiometricGateScreen } from '../BiometricGateScreen';

/**
 * What the gate does before, and around, the answers it needs from the device (#1116).
 *
 * A login forces a re-read of the stored PIN and biometric flag, and the gate can mount while
 * that read is still in flight. Deciding then means deciding on defaults — "no PIN,
 * biometrics off" — which sent a returning customer to create a second PIN, and to the
 * keypad instead of the sensor on the next launch.
 *
 * Every case mounts the screen once and renders it no further, so they live in a file of
 * their own: the test renderer drives one screen at a time, and these cases each need a
 * live one.
 */

const mockAuthenticateAsync = jest.fn();
const mockHasHardwareAsync = jest.fn();
const mockIsEnrolledAsync = jest.fn();

jest.mock('expo-local-authentication', () => ({
  authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
  hasHardwareAsync: (...args: unknown[]) => mockHasHardwareAsync(...args),
  isEnrolledAsync: (...args: unknown[]) => mockIsEnrolledAsync(...args),
  supportedBiometryTypes: jest.fn(),
  BiometryType: { Fingerprint: 1, FaceID: 2, Iris: 3 },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('../../../theme/useAuroraSkin', () => ({
  useAuroraSkin: () => ({ dark: false, ink: '#000', ink2: '#666', hair: '#ccc' }),
}));

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('expo-linear-gradient', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement(View, null, children),
  };
});

jest.mock('../../../components/common/GlassCard', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    GlassCard: ({ children, ...props }: { children: React.ReactNode }) =>
      ReactLocal.createElement(View, props, children),
  };
});

jest.mock('../../../components/common/GlassScreen', () => {
  const ReactLocal = require('react');
  const { View } = require('react-native');
  return {
    GlassScreen: ({ children }: { children: React.ReactNode }) =>
      ReactLocal.createElement(View, null, children),
  };
});

jest.mock('react-native-paper', () => {
  const ReactLocal = require('react');
  const { Text: RNText, View } = require('react-native');
  return {
    Text: ({ children, onPress, ...props }: Record<string, unknown>) =>
      ReactLocal.createElement(RNText, { ...props, onPress }, children),
    ActivityIndicator: (props: Record<string, unknown>) => ReactLocal.createElement(View, props),
  };
});

// The app's one AppState source, mocked so a case can move the app out of the foreground and
// back: the gate re-opens a prompt the system dismissed when it is in front again.
const mockAppState = {
  currentState: 'active' as string,
  currentListeners: new Set<(state: string) => void>(),
};

jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true,
  default: {
    get currentState() {
      return mockAppState.currentState;
    },
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockAppState.currentListeners.add(listener);
      return {
        remove: () => {
          mockAppState.currentListeners.delete(listener);
        },
      };
    },
  },
}));

/** Delivers a transition to the screen that is mounted, as the OS would. */
const deliverAppState = (next: string) => {
  const listeners = Array.from(mockAppState.currentListeners);
  mockAppState.currentState = next;
  act(() => {
    for (const listener of listeners) listener(next);
  });
};

jest.mock('../../../store/biometricStore', () => {
  const stores = jest.requireActual('../../../__test-support__/lockStoreMocks');
  return {
    useBiometricStore: stores.useBiometricStore,
    hydrateBiometricStore: stores.hydrateBiometricStore,
    subscribeBiometricAnswering: stores.subscribeBiometricAnswering,
    isBiometricAnswerKnown: stores.isBiometricAnswerKnown,
  };
});

jest.mock('../../../store/pinStore', () => {
  const stores = jest.requireActual('../../../__test-support__/lockStoreMocks');
  return {
    usePinStore: stores.usePinStore,
    hydratePinStore: stores.hydratePinStore,
    subscribePinAnswering: stores.subscribePinAnswering,
    isPinAnswerKnown: stores.isPinAnswerKnown,
  };
});

// Below the factories on purpose: Jest hoists the `jest.mock` calls, and the helper has to
// come from the registry they populate. The file then reads top-down as the suite does.
// eslint-disable-next-line import/first
import {
  defaultLockStores,
  mockDeviceEnrolled,
  mockLockStores,
  type LockStores,
} from '../../../__test-support__/lockStoreMocks';

const mockClearAuth = jest.fn();
const defaultAuthState = { clearAuth: mockClearAuth, needsOnboarding: false };
let mockAuthState: typeof defaultAuthState = defaultAuthState;

jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn((selector?: (s: typeof defaultAuthState) => unknown) => {
    const state = mockAuthState;
    return selector ? selector(state) : state;
  }),
}));

const mockSetUnlocked = jest.fn();
jest.mock('../../../store/lockStore', () => ({
  useLockStore: jest.fn((selector?: (s: { setUnlocked: jest.Mock }) => unknown) => {
    const state = { setUnlocked: mockSetUnlocked };
    return selector ? selector(state) : state;
  }),
}));

const mockReset = jest.fn();
const mockReplace = jest.fn();
const mockNavigation = {
  reset: mockReset,
  replace: mockReplace,
  // The handover only fires while this screen owns the navigator (#1116).
  isFocused: () => true,
} as unknown as React.ComponentProps<typeof BiometricGateScreen>['navigation'];
const mockRoute = {} as unknown as React.ComponentProps<typeof BiometricGateScreen>['route'];

const seeStoredState = (state: LockStores) => {
  mockLockStores.current = state;
  mockDeviceEnrolled.current = true;
  mockIsEnrolledAsync.mockImplementation(() => Promise.resolve(mockDeviceEnrolled.current));
};

/**
 * A login's forced read: neither answer is known until the read lands. `answer` is what the
 * read finds; the returned `lands` says the read has answered, and re-renders the screen.
 */
const startFromALogin = (stored: { hasPin: boolean; biometricEnabled: boolean }) => {
  seeStoredState({
    biometric: { ...defaultLockStores().biometric, biometricEnabled: false, hydrated: false },
    biometricAnswerKnown: false,
    pin: { hasPin: false, hydrated: false },
    pinAnswerKnown: false,
  });

  return async (view: ReturnType<typeof render> extends Promise<infer R> ? R : never) => {
    seeStoredState({
      ...mockLockStores.current,
      biometric: {
        ...mockLockStores.current.biometric,
        biometricEnabled: stored.biometricEnabled,
        hydrated: true,
      },
      biometricAnswerKnown: true,
      pin: { hasPin: stored.hasPin, hydrated: true },
      pinAnswerKnown: true,
    });
    // The renderer wraps its own act and is async: awaiting it lets the effects it starts
    // run before the assertions instead of inside the next `act`.
    await view.rerender(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState = defaultAuthState;
  seeStoredState(defaultLockStores());
  mockHasHardwareAsync.mockResolvedValue(true);
  mockAuthenticateAsync.mockResolvedValue({ success: true });
  // One world per file: a case that moved the app to the background must not leave the
  // next one there.
  mockAppState.currentState = 'active';
  mockAppState.currentListeners.clear();
});

describe('BiometricGateScreen – the stored answers (#1116)', () => {
  it('does not decide while the reads are pending, and uses what they find', async () => {
    const lands = startFromALogin({ hasPin: true, biometricEnabled: true });
    const view = await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    // Nothing is decided, and no PIN is asked for, while the answer is on its way. Checked
    // after a few turns: an effect that decided on the defaults has run by then.
    await act(async () => {});
    await act(async () => {});
    expect(mockReset).not.toHaveBeenCalled();
    expect(mockAuthenticateAsync).not.toHaveBeenCalled();

    await lands(view);

    // What the read found is used: biometrics were on, so the sensor is asked — not the
    // "create your PIN" a returning customer was sent to.
    await waitFor(() => expect(mockAuthenticateAsync).toHaveBeenCalledTimes(1));
    expect(mockReset).not.toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PinSetup' }] });
  });

  it('asks the sensor on its own once the stored answer says biometrics are on', async () => {
    const lands = startFromALogin({ hasPin: true, biometricEnabled: true });
    const view = await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
    await lands(view);

    await waitFor(() => expect(mockSetUnlocked).toHaveBeenCalled());
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    // One prompt: the wait must not be answered by two effects racing each other.
    expect(mockAuthenticateAsync).toHaveBeenCalledTimes(1);
  });

  it('with a PIN on the device, the sensor refusing leads to the keypad and not the setup', async () => {
    // Which *lock* a session opens on is `SessionNavigator`'s job (`sessionEntryScreen`);
    // what the gate still owes is that a PIN it found is never treated as "none": the
    // handover goes to the keypad, not back to the setup.
    mockHasHardwareAsync.mockResolvedValue(false);
    const lands = startFromALogin({ hasPin: true, biometricEnabled: false });
    const view = await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
    await lands(view);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('PinEntry'));
    expect(mockReplace).not.toHaveBeenCalledWith('PinSetup');
  });

  it('with no PIN on the device, the handover creates one', async () => {
    mockHasHardwareAsync.mockResolvedValue(false);
    const lands = startFromALogin({ hasPin: false, biometricEnabled: false });
    const view = await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
    await lands(view);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('PinSetup'));
  });

  it('does not count a dismissed prompt as a lost sensor, and asks again', async () => {
    // Dismissing the dialog (user_cancel, system_cancel, …) proves nothing about the
    // sensor. Counted as failures, a few dismissals reached the limit the PIN is meant to
    // end, which is the "it goes to the PIN page instead of biometrics" report.
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'system_cancel' });
    mockAppState.currentState = 'active';

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
    await waitFor(() => expect(mockAuthenticateAsync).toHaveBeenCalledTimes(1));
    // Let the first prompt settle before interrupting, as a customer would.
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 5); });
    });

    for (let dismissals = 1; dismissals <= 3; dismissals += 1) {
      deliverAppState('background');
      deliverAppState('active');
      await waitFor(() => expect(mockAuthenticateAsync).toHaveBeenCalledTimes(dismissals + 1));
      await act(async () => {
        await new Promise((resolve) => { setTimeout(resolve, 5); });
      });
    }

    // The sensor is still the way in: no keypad, no fallback card, no forced PIN.
    expect(mockReset).not.toHaveBeenCalled();
    expect(screen.queryByTestId('biometric-fallback')).toBeNull();
    expect(mockSetUnlocked).not.toHaveBeenCalled();
  });
});



