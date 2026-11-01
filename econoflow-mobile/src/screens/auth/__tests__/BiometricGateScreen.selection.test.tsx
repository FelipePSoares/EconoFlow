import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';

import { BiometricGateScreen } from '../BiometricGateScreen';

/**
 * The gate is only ever the session's **first** screen when the device has a PIN and
 * biometrics on — `SessionNavigator` decides that with `initialRouteName` (see
 * `sessionEntry.test.ts`). This suite is about the one direction it still moves on its own:
 * the sensor gave up (no usable hardware, or out of attempts), and the PIN takes over.
 *
 * What it must never do is redirect on mount: that was the `reset` React Navigation dropped
 * while the stack was still mounting, which left a successful login on a blank screen
 * (#1116).
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

beforeEach(() => {
  jest.clearAllMocks();
  mockAuthState = defaultAuthState;
  seeStoredState(defaultLockStores());
  mockHasHardwareAsync.mockResolvedValue(true);
  mockAuthenticateAsync.mockResolvedValue({ success: true });
});

describe('BiometricGateScreen – handing over to the PIN', () => {
  it('hands over to the keypad when the device has no sensor to ask', async () => {
    mockHasHardwareAsync.mockResolvedValue(false);

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockAuthenticateAsync).not.toHaveBeenCalled();
      expect(mockReplace).toHaveBeenCalledWith('PinEntry');
    });
  });

  it('sends a device with no PIN at all to create one', async () => {
    // A device cannot be unlocked by a sensor alone: when the PIN is not there, the handover
    // goes to the setup, not to the keypad.
    mockHasHardwareAsync.mockResolvedValue(false);
    seeStoredState({ ...defaultLockStores(), pin: { hasPin: false, hydrated: true } });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('PinSetup'));
    expect(mockAuthenticateAsync).not.toHaveBeenCalled();
  });

  it('hands over once the sensor is out of attempts', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
    await waitFor(() => expect(screen.getByTestId('biometric-fallback')).toBeTruthy());
    // One failure is still within the sensor's own retry budget: no PIN yet.
    expect(mockReplace).not.toHaveBeenCalled();

    for (let i = 0; i < 2; i += 1) {
      await waitFor(() => expect(screen.getByTestId('biometric-retry')).toBeTruthy());
      fireEventPressRetry();
      await waitFor(() => expect(mockAuthenticateAsync).toHaveBeenCalledTimes(2 + i));
    }

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('PinEntry'));
  });

  it('does not offer the PIN in front of a working sensor', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
    await waitFor(() => expect(screen.getByTestId('biometric-fallback')).toBeTruthy());

    expect(screen.queryByTestId('biometric-use-pin')).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('never redirects on mount, whatever the stores say (#1116)', async () => {
    // The defect behind the blank screen: the gate was mounted over a session whose PIN
    // existed but whose biometric flag was off, and its mount effect redirected away. The
    // stack's first route is decided before the gate mounts (`sessionEntryScreen`), so a
    // mounted gate stays put — it does not guess its way out of being on screen.
    const declined = {
      ...defaultLockStores(),
      biometric: { ...defaultLockStores().biometric, biometricEnabled: false, biometricPromptSkipped: true },
    };
    const biometricsOff = {
      ...defaultLockStores(),
      biometric: { ...defaultLockStores().biometric, biometricEnabled: false },
    };

    for (const state of [declined, biometricsOff]) {
      seeStoredState(state);
      // The sensor answers at once: a mounted gate may open the app (that is the customer
      // getting in), but it may not send itself to another lock screen.
      const view = await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
      await new Promise((resolve) => { setTimeout(resolve, 5); });

      expect(mockReplace).not.toHaveBeenCalled();
      view.unmount();
    }
  });
});

/** The retry row is a `Pressable`; firing its press needs the element, not its id alone. */
function fireEventPressRetry() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { fireEvent } = require('@testing-library/react-native');
  fireEvent.press(screen.getByTestId('biometric-retry'));
}




