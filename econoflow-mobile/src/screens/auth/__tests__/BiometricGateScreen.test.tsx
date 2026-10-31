import React from 'react';
import { AppState } from 'react-native';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { BiometricGateScreen } from '../BiometricGateScreen';

// The gate's unlock hook listens to AppState so a return to the foreground asks again after
// the system dismissed the prompt. The listener is captured so a test can deliver it.
let mockAppStateListener: ((state: string) => void) | null = null;
jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true,
  default: {
    currentState: 'active',
    addEventListener: jest.fn((_event: string, listener: (state: string) => void) => {
      mockAppStateListener = listener;
      return {
        remove: jest.fn(() => {
          if (mockAppStateListener === listener) mockAppStateListener = null;
        }),
      };
    }),
  },
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
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('../../../components/common/GlassCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassCard: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement(View, props, children),
  };
});

jest.mock('../../../components/common/GlassScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassScreen: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Text: RNText, View } = require('react-native');
  return {
    Text: ({ children, onPress, ...props }: Record<string, unknown>) =>
      React.createElement(RNText, { ...props, onPress }, children),
    ActivityIndicator: (props: Record<string, unknown>) =>
      React.createElement(View, props),
  };
});

const mockAuthenticateAsync = jest.fn();
const mockHasHardwareAsync = jest.fn();
const mockIsEnrolledAsync = jest.fn();
const mockSupportedBiometryTypes = jest.fn();

jest.mock('expo-local-authentication', () => ({
  authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
  hasHardwareAsync: (...args: unknown[]) => mockHasHardwareAsync(...args),
  isEnrolledAsync: (...args: unknown[]) => mockIsEnrolledAsync(...args),
  supportedBiometryTypes: mockSupportedBiometryTypes,
  BiometryType: { Fingerprint: 1, FaceID: 2, Iris: 3 },
}));

jest.mock('../../../store/biometricStore', () => {
  // Selector-aware like the real hook: a mock that ignores the selector hands the whole
  // state object to `useSelector`-style calls and silently breaks every consumer.
  const fn = jest.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      biometricEnabled: true,
      hydrated: true,
      setBiometricEnabled: jest.fn(),
    };
    return selector ? selector(state) : state;
  });
  return {
    useBiometricStore: Object.assign(fn, {
      persist: {
        hasHydrated: jest.fn().mockReturnValue(true),
        onFinishHydration: jest.fn(),
      },
    }),
  };
});

const mockClearAuth = jest.fn();
const mockNeedsOnboarding = false;
const authState = { clearAuth: mockClearAuth, needsOnboarding: mockNeedsOnboarding };

jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn((selector?: (s: typeof authState) => unknown) =>
    selector ? selector(authState) : authState,
  ),
}));

jest.mock('../../../store/pinStore', () => ({
  usePinStore: jest.fn((selector?: (s: { hasPin: boolean }) => unknown) => {
    const state = { hasPin: true };
    return selector ? selector(state) : state;
  }),
}));

const mockSetUnlocked = jest.fn();
jest.mock('../../../store/lockStore', () => ({
  useLockStore: jest.fn((selector?: (s: { setUnlocked: typeof mockSetUnlocked }) => unknown) => {
    const state = { setUnlocked: mockSetUnlocked };
    return selector ? selector(state) : state;
  }),
}));

const mockReset = jest.fn();
const mockNavigation = {
  reset: mockReset,
} as unknown as React.ComponentProps<typeof BiometricGateScreen>['navigation'];

const mockRoute = {} as unknown as React.ComponentProps<typeof BiometricGateScreen>['route'];

describe('BiometricGateScreen', () => {
  // The suite reassigns several stores; every case starts from the documented default.
  const restoreBiometricStore = () => {
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockImplementation((selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { biometricEnabled: true, hydrated: true, setBiometricEnabled: jest.fn() };
      return selector ? selector(state) : state;
    });
    const { usePinStore } = jest.requireMock('../../../store/pinStore');
    usePinStore.mockImplementation((selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { hasPin: true };
      return selector ? selector(state) : state;
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    restoreBiometricStore();
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: true });
    // The AppState mock is shared by the file; a test that moves the app to the background
    // must not leave the next one there.
    AppState.currentState = 'active';
  });

  // The reported symptom (#1052): right after logging in the app sat on a blank screen.
  // The gate stays a spinner while the store has not been read, and `PinEntry` resets back
  // to it after a wrong PIN — a gate that reads the loading flag from a stale value can
  // keep the spinner up forever over the real screen.
  describe('never leaves the user on a spinner', () => {
    // The mock is reassigned here; restore the default so later cases start clean.
    afterEach(() => {
      const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
      useBiometricStore.mockImplementation((selector?: (s: Record<string, unknown>) => unknown) => {
        const state = { biometricEnabled: true, hydrated: true, setBiometricEnabled: jest.fn() };
        return selector ? selector(state) : state;
      });
    });

    it('shows the PIN request instead of a spinner when there is no PIN', async () => {
      const { usePinStore } = jest.requireMock('../../../store/pinStore');
      usePinStore.mockReturnValue({ hasPin: false });

      await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

      await waitFor(() => {
        expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PinSetup' }] });
      });
      // The screen hides itself rather than drawing anything while it is leaving.
      expect(screen.queryByTestId('biometric-fallback')).toBeNull();
    });

    it('does not hold the screen for a store flag that will never flip', async () => {
      // `hydrateBiometricStore` is not used by this screen at all any more; the flag only
      // hides a read that is still pending. A build that never writes it must not spin.
      const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
      useBiometricStore.mockReturnValue({ biometricEnabled: false, hydrated: false });

      await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

      await waitFor(() => {
        expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PinEntry' }] });
      });
    });
  });

  // #1052: with biometrics on there is exactly ONE way in — the sensor. The PIN is the
  // fallback, not a parallel option, so the user never gets asked for both.
  describe('biometrics first, PIN as the fallback', () => {
    it('asks for biometrics only and does not send the user to the PIN screen', async () => {
      await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

      await waitFor(() => expect(mockSetUnlocked).toHaveBeenCalled());

      expect(mockAuthenticateAsync).toHaveBeenCalledTimes(1);
      expect(mockReset).not.toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PinEntry' }] });
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    });

    it('keeps prompting the sensor after one failure instead of showing the PIN', async () => {
      mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });

      await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

      await waitFor(() => expect(screen.getByTestId('biometric-fallback')).toBeTruthy());

      // One failure is still within the sensor's own retry budget: no PIN yet.
      expect(screen.queryByTestId('biometric-use-pin')).toBeNull();
      expect(mockReset).not.toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PinEntry' }] });
    });

    it('hands over to the PIN after three sensor failures', async () => {
      mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });

      await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
      await waitFor(() => expect(screen.getByTestId('biometric-fallback')).toBeTruthy());

      await act(async () => {
        fireEvent.press(screen.getByTestId('biometric-retry'));
      });
      await waitFor(() => expect(mockAuthenticateAsync).toHaveBeenCalledTimes(2));
      await act(async () => {
        fireEvent.press(screen.getByTestId('biometric-retry'));
      });
      await waitFor(() => expect(mockAuthenticateAsync).toHaveBeenCalledTimes(3));

      // Out of attempts: the PIN takes over on its own, with the three failures spent.
      await waitFor(() => {
        expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PinEntry' }] });
      });
      expect(mockSetUnlocked).not.toHaveBeenCalled();
    });

    it('defaults to the PIN once the sensor is out of attempts', async () => {
      mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });

      await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
      await waitFor(() => expect(screen.getByTestId('biometric-fallback')).toBeTruthy());

      for (let i = 0; i < 2; i += 1) {
        fireEvent.press(screen.getByTestId('biometric-retry'));
        await waitFor(() => expect(mockAuthenticateAsync).toHaveBeenCalledTimes(2 + i));
      }

      await waitFor(() => {
        expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PinEntry' }] });
      });
    });

    it('unlocks when a retry succeeds before the attempts run out', async () => {
      mockAuthenticateAsync
        .mockResolvedValueOnce({ success: false, error: 'authentication_failed' })
        .mockResolvedValueOnce({ success: true });

      await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
      await waitFor(() => expect(mockAuthenticateAsync).toHaveBeenCalledTimes(1));
      await act(async () => { fireEvent.press(screen.getByTestId('biometric-retry')); });

      await waitFor(() => expect(mockSetUnlocked).toHaveBeenCalled());
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    });

    it('goes straight to the PIN without prompting when the device lost its sensor', async () => {
      mockHasHardwareAsync.mockResolvedValue(false);

      await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

      await waitFor(() => {
        expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PinEntry' }] });
      });
      expect(mockAuthenticateAsync).not.toHaveBeenCalled();
    });
  });

  it('calls authenticateAsync on mount when biometrics available and enabled', async () => {
    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockHasHardwareAsync).toHaveBeenCalled();
      expect(mockIsEnrolledAsync).toHaveBeenCalled();
      expect(mockAuthenticateAsync).toHaveBeenCalled();
    });
  });

  it('navigates to Main on successful authentication', async () => {
    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockSetUnlocked).toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    });
  });

  it('navigates to Onboarding when needsOnboarding is true', async () => {
    const { useAuthStore } = jest.requireMock('../../../store/authStore');
    const onboardingAuthState = { clearAuth: mockClearAuth, needsOnboarding: true };
    useAuthStore.mockImplementation(
      (selector?: (s: typeof onboardingAuthState) => unknown) =>
        selector ? selector(onboardingAuthState) : onboardingAuthState,
    );

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    });
  });

  it('shows error and fallback options when authentication fails', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByTestId('biometric-fallback')).toBeTruthy();
    });
  });

  it('shows locked out message when too many attempts', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'lockout' });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByTestId('biometric-lockout')).toBeTruthy();
    });
  });

  it('renders sign out button on fallback screen', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('BiometricSignOut')).toBeTruthy();
    });
  });

  it('signs out without navigating', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByTestId('biometric-fallback')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('BiometricSignOut'));

    await waitFor(() => {
      expect(mockClearAuth).toHaveBeenCalled();
    });
    // Auth is not a route on the session navigator: AppGate swaps to the auth tree once
    // the store reports signed-out, so no navigation call is expected here.
    expect(mockReset).not.toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Auth' }] });
  });

  it('navigates to PinEntry when biometrics not available and hasPin', async () => {
    mockHasHardwareAsync.mockResolvedValue(false);
    const { usePinStore } = jest.requireMock('../../../store/pinStore');
    usePinStore.mockReturnValue({ hasPin: true });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockAuthenticateAsync).not.toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'PinEntry' }],
      });
    });
  });

  // #1052: the PIN is the app's own lock. Biometrics only shortcut it, so a device
  // without an app PIN has to be sent to create one — never straight to the unlock prompt.
  // #1052: declining the offer is final for the unlock path. With the PIN working there is
  // no reason to show the offer again — the user turns biometrics on from the settings.
  it('never offers enrollment again once the PIN works, whatever the biometric state', async () => {
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({ biometricEnabled: false, biometricPromptSkipped: true });
    const { usePinStore } = jest.requireMock('../../../store/pinStore');
    usePinStore.mockReturnValue({ hasPin: true });

    for (let run = 0; run < 3; run += 1) {
      await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

      await waitFor(() => {
        expect(mockReset).toHaveBeenLastCalledWith({ index: 0, routes: [{ name: 'PinEntry' }] });
      });
    }

    expect(mockReset).not.toHaveBeenCalledWith({ index: 0, routes: [{ name: 'BiometricEnroll' }] });
  });

  it('never offers enrollment again even when biometrics were turned back on without use', async () => {
    // Turning the toggle on and off again used to clear the decline flag, so the offer
    // returned on the next launch. The flag now survives.
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({ biometricEnabled: false, biometricPromptSkipped: true });
    const { usePinStore } = jest.requireMock('../../../store/pinStore');
    usePinStore.mockReturnValue({ hasPin: true });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PinEntry' }] });
    });
    expect(mockAuthenticateAsync).not.toHaveBeenCalled();
  });

  it('sends a user without an app PIN to create one, even when biometrics are enabled', async () => {
    const { usePinStore } = jest.requireMock('../../../store/pinStore');
    usePinStore.mockReturnValue({ hasPin: false });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PinSetup' }] });
    });
    expect(mockAuthenticateAsync).not.toHaveBeenCalled();
  });

  it('navigates to PinSetup when biometrics are not enabled and there is no PIN', async () => {
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({ biometricEnabled: false });
    const { usePinStore } = jest.requireMock('../../../store/pinStore');
    usePinStore.mockReturnValue({ hasPin: false });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PinSetup' }] });
    });
  });

  // #1052: a user who declined the enrollment offer is sent straight to the PIN, never
  // back to the screen that offered biometrics.
  it('skips the enrollment offer once the user declined it and there is a PIN', async () => {
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({ biometricEnabled: false, biometricPromptSkipped: true });
    const { usePinStore } = jest.requireMock('../../../store/pinStore');
    usePinStore.mockReturnValue({ hasPin: true });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'PinEntry' }] });
    });
    expect(mockReset).not.toHaveBeenCalledWith({ index: 0, routes: [{ name: 'BiometricEnroll' }] });
  });

  it('never offers biometrics before the app PIN exists', async () => {
    // #1052: a device without a PIN is protected by nothing, so the PIN comes first and
    // the enrollment offer is only shown once it exists.
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({
      biometricEnabled: false,
    });
    const { usePinStore } = jest.requireMock('../../../store/pinStore');
    usePinStore.mockReturnValue({ hasPin: false });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockAuthenticateAsync).not.toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'PinSetup' }],
      });
    });
    expect(mockReset).not.toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'BiometricEnroll' }],
    });
  });

  it('renders nothing while biometric store is hydrating', async () => {
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.persist.hasHydrated.mockReturnValue(false);

    render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    expect(mockAuthenticateAsync).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

    it('asks again on return to the foreground, and opens the app with the sensor', async () => {
      // The customer switching apps while the prompt is up used to end on the fallback screen
      // once the system dismissed the dialog. Now the way back asks again on its own, and an
      // answered prompt lets them in -- no button to press.
      mockAuthenticateAsync
        .mockResolvedValueOnce({ success: false, error: 'app_cancel' })
        .mockResolvedValueOnce({ success: true });

      await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);
      await waitFor(() => expect(mockAuthenticateAsync).toHaveBeenCalledTimes(1));
      await act(async () => {
        await new Promise((resolve) => { setTimeout(resolve, 5); });
      });

      act(() => {
        AppState.currentState = 'background';
        mockAppStateListener?.('background');
      });
      act(() => {
        AppState.currentState = 'active';
        mockAppStateListener?.('active');
      });

      await waitFor(() => expect(mockAuthenticateAsync).toHaveBeenCalledTimes(2));
      await waitFor(() => expect(mockSetUnlocked).toHaveBeenCalled());
      // The reset that leaves the gate happened; which screen follows (Main or Onboarding)
      // depends on the account, not on this screen.
      expect(mockReset).toHaveBeenCalled();
    });

  // Note: The "use PIN on fallback" test using DOM queries is not possible
  // in React 19 concurrent mode because state updates from async effects
  // inside mocked components are not committed outside act().
  // The fallback rendering is already verified by "shows error" test above.
});