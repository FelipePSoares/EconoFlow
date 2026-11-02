import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { BiometricGateScreen } from '../BiometricGateScreen';

/**
 * What the entrance screen shows, and how it is left.
 *
 * Every case here mounts the gate from the app's steady state (biometrics on, enrolled, a
 * PIN on the device, nothing stored yet) and checks the first thing the customer sees: the
 * sensor, the spinner while the stored answers are read, or the fallback card. The suites
 * beside this one follow a single subject each — who gets in (`…unlock`), which lock is
 * offered (`…selection`) and whether the screen decides before the device answered
 * (`…hydration`) — because the test renderer drives the screen one case at a time: a case
 * that mounts a block of its own does not always leave a live tree for the next.
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
const mockNavigation = {
  reset: mockReset,
  // The gate asks whether the stack is active before it navigates: a reset sent while the
  // navigator is still mounting is dropped by React Navigation (#1116).
  isFocused: () => true,
} as unknown as React.ComponentProps<typeof BiometricGateScreen>['navigation'];
const mockRoute = {} as unknown as React.ComponentProps<typeof BiometricGateScreen>['route'];

/**
 * Makes the gate read `state` — the device the next render sees. The device is enrolled
 * with biometrics unless a case says otherwise, so the cases that prompt a real sensor get
 * a device that has one.
 */
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

describe('BiometricGateScreen – the entrance', () => {
  it('asks the sensor on mount when biometrics are available and enabled', async () => {
    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockHasHardwareAsync).toHaveBeenCalled();
      expect(mockIsEnrolledAsync).toHaveBeenCalled();
      expect(mockAuthenticateAsync).toHaveBeenCalled();
    });
  });

  it('opens the app on a successful authentication', async () => {
    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockSetUnlocked).toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    });
  });

  it('opens onboarding instead when the account still needs one', async () => {
    mockAuthState = { clearAuth: mockClearAuth, needsOnboarding: true };

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Onboarding' }] });
    });
  });

  it('shows the fallback options when the sensor refuses', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByTestId('biometric-fallback')).toBeTruthy();
    });
  });

  it('says so when the system locked the sensor out', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'lockout' });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByTestId('biometric-lockout')).toBeTruthy();
    });
  });

  it('offers a way out of the fallback, and signs out without navigating', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
    await waitFor(() => {
      expect(screen.getByTestId('biometric-sign-out')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('biometric-sign-out'));

    await waitFor(() => {
      expect(mockClearAuth).toHaveBeenCalled();
    });
    // Auth is not a route on the session navigator: `AppGate` swaps to the auth tree once
    // the store reports signed-out, so no navigation call is expected here.
    expect(mockReset).not.toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Auth' }] });
  });

  it('renders nothing while the stored biometric answer is being read (#1116)', async () => {
    seeStoredState({ ...defaultLockStores(), biometricAnswerKnown: false });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    expect(mockAuthenticateAsync).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it('renders nothing while the stored PIN is being read (#1116)', async () => {
    seeStoredState({
      ...defaultLockStores(),
      pin: { hasPin: false, hydrated: false },
      pinAnswerKnown: false,
    });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    expect(mockReset).not.toHaveBeenCalled();
    expect(mockAuthenticateAsync).not.toHaveBeenCalled();
  });
});

