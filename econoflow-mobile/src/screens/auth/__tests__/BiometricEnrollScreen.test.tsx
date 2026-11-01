import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { BiometricEnrollScreen } from '../BiometricEnrollScreen';
import { useBiometricStore } from '../../../store/biometricStore';
import { usePinStore } from '../../../store/pinStore';

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
    GlassCard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
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
  const { Text: RNText } = require('react-native');
  return {
    Text: ({ children, onPress, ...props }: Record<string, unknown>) =>
      React.createElement(RNText, { ...props, onPress }, children),
  };
});

jest.mock('../../../theme/useAppTheme', () => ({
  // The button and the gradient take their colours from the app theme (#1052 — no
  // hard-coded colours), so the mock provides the palette the real hook returns.
  useAppTheme: () => ({
    colors: { primary: '#0f76a8', onPrimary: '#fff' },
    customColors: { accentGreen: '#14c08a' },
  }),
}));

jest.mock('../../../components/common/ErrorBanner', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    ErrorBanner: ({
      visible, message, onDismiss,
    }: {
      visible: boolean;
      message?: string;
      onDismiss: () => void;
    }) => {
      if (!visible) return null;
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(Text, { testID: 'error-banner' }, message ?? 'ErrorGeneric'),
        React.createElement(TouchableOpacity, { testID: 'error-banner-dismiss', onPress: onDismiss }),
      );
    },
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

// The store is the real one: the screen must persist through it exactly as the app does,
// and the hydration guard of the toggle lives in the store.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn().mockReturnValue({
    needsOnboarding: false,
  }),
}));

const mockSetUnlocked = jest.fn();
jest.mock('../../../store/lockStore', () => ({
  useLockStore: jest.fn(
    (selector?: (s: { setUnlocked: typeof mockSetUnlocked }) => unknown) => {
      const state = { setUnlocked: mockSetUnlocked };
      return selector ? selector(state) : state;
    },
  ),
}));

const mockReset = jest.fn();
const mockReplace = jest.fn();
const mockNavigation = {
  reset: mockReset,
  replace: mockReplace,
} as unknown as React.ComponentProps<typeof BiometricEnrollScreen>['navigation'];

const mockRoute = {} as unknown as React.ComponentProps<typeof BiometricEnrollScreen>['route'];

describe('BiometricEnrollScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useBiometricStore.setState({
      biometricEnabled: false,
      biometricPromptSkipped: false,
      hydrated: true,
    });
    // A device with a working sensor, unless the case says otherwise: without this the
    // screen offers nothing and the "Enable" cases have nothing to press.
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    // The decline is persisted, so a case that records one must not decide the next case:
    // the screen reads the store's answer, and that answer has to be about this case only.
    usePinStore.setState({ pinHash: null, hasPin: false });
    // A case that holds the stored answer back must not leave it held for the next one:
    // the screen waits for it, and the cases after would wait forever.
    useBiometricStore.persist.hasHydrated = () => true;
  });

  // #1116: the decline is only an answer once the store has been read. While it is still
  // on its way the screen offers biometrics to a customer who had already said no — and
  // that offer, after logging in, is the flow the report describes as broken.
  it('offers nothing before the stored decline has been read', async () => {
    const { usePinStore } = jest.requireActual('../../../store/pinStore');
    usePinStore.setState({ pinHash: 'hash:1234', hasPin: true, hydrated: true });
    useBiometricStore.setState({ biometricPromptSkipped: true, hydrated: false });
    const persistence = useBiometricStore.persist;
    const originalHasHydrated = persistence.hasHydrated;
    persistence.hasHydrated = () => false;

    try {
      await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

      // Neither the offer nor a decision: the answer is still unknown.
      expect(screen.queryByTestId('biometric-enroll-enable')).toBeNull();
      expect(mockReset).not.toHaveBeenCalled();
    } finally {
      persistence.hasHydrated = originalHasHydrated;
    }
  });

  // ── Nothing to offer is shown, not navigated away from (#1116) ──────────────
  //
  // The offer used to redirect itself on mount when it had nothing to offer. That `reset`
  // was dropped by React Navigation while the stack was still mounting, and the blank
  // result is the screen the customer got after a successful login. What it does now is say
  // so, and let the customer continue — one tap, on a screen that is up.

  it('says the offer is gone when the customer already declined it', async () => {
    const { usePinStore } = jest.requireActual('../../../store/pinStore');
    usePinStore.setState({ pinHash: 'hash:1234', hasPin: true, hydrated: true });
    useBiometricStore.getState().setBiometricPromptSkipped();

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => expect(screen.getByTestId('biometric-enroll-cannot-offer')).toBeTruthy());
    // Nothing redirects itself: the stack stays on the screen the customer can see.
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('says the offer is gone when the device has no biometric hardware', async () => {
    const { usePinStore } = jest.requireActual('../../../store/pinStore');
    usePinStore.setState({ pinHash: 'hash:1234', hasPin: true, hydrated: true });
    mockHasHardwareAsync.mockResolvedValue(false);

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => expect(screen.getByTestId('biometric-enroll-cannot-offer')).toBeTruthy());
    expect(screen.queryByTestId('biometric-enroll-enable')).toBeNull();
  });

  it('says the offer is gone when nothing is enrolled', async () => {
    const { usePinStore } = jest.requireActual('../../../store/pinStore');
    usePinStore.setState({ pinHash: 'hash:1234', hasPin: true, hydrated: true });
    mockIsEnrolledAsync.mockResolvedValue(false);

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => expect(screen.getByTestId('biometric-enroll-cannot-offer')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('lets the customer in when they tap past an offer it cannot make, the PIN being set', async () => {
    // The PIN already protects the session, so the way forward is into the app — not back to
    // a keypad the customer is not being asked for.
    const { usePinStore } = jest.requireActual('../../../store/pinStore');
    usePinStore.setState({ pinHash: 'hash:1234', hasPin: true, hydrated: true });
    mockHasHardwareAsync.mockResolvedValue(false);

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);
    await waitFor(() => expect(screen.getByTestId('biometric-enroll-cannot-offer')).toBeTruthy());

    fireEvent.press(screen.getByTestId('biometric-enroll-cannot-offer'));

    await waitFor(() => expect(mockSetUnlocked).toHaveBeenCalled());
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
  });

  it('offers the PIN setup on the way out when there is no PIN yet', async () => {
    const { usePinStore } = jest.requireActual('../../../store/pinStore');
    usePinStore.setState({ pinHash: null, hasPin: false, hydrated: true });
    mockHasHardwareAsync.mockResolvedValue(false);

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);
    await waitFor(() => expect(screen.getByTestId('biometric-enroll-cannot-offer')).toBeTruthy());

    fireEvent.press(screen.getByTestId('biometric-enroll-cannot-offer'));

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('PinSetup'));
  });

  it('does not stay blank when the hardware query throws', async () => {
    // A rejected native call used to leave the screen blank forever, because nothing set
    // the "checked" state. It now reads as "cannot offer", which is a screen.
    const { usePinStore } = jest.requireActual('../../../store/pinStore');
    usePinStore.setState({ pinHash: null, hasPin: false, hydrated: true });
    mockHasHardwareAsync.mockRejectedValue(new Error('native module missing'));

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => expect(screen.getByTestId('biometric-enroll-cannot-offer')).toBeTruthy());
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('renders enrollment UI when biometrics are available', async () => {
    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('BiometricEnrollTitle')).toBeTruthy();
      expect(screen.getByText('BiometricEnrollMessage')).toBeTruthy();
      expect(screen.getByText('BiometricEnrollEnable')).toBeTruthy();
      expect(screen.getByText('BiometricEnrollSkip')).toBeTruthy();
    });
  });

  it('calls setBiometricEnabled and navigates to BiometricGate on Enable', async () => {
    // The offer only exists once the app PIN does (#1052); Enable then retries the unlock.
    const { usePinStore } = jest.requireActual('../../../store/pinStore');
    usePinStore.setState({ pinHash: 'hash:1234', hasPin: true, hydrated: true });
    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    const enableButton = await screen.findByTestId('biometric-enroll-enable');
    expect(enableButton.props.accessibilityRole).toBe('button');

    fireEvent.press(screen.getByTestId('biometric-enroll-enable'));

    await waitFor(() => {
      expect(useBiometricStore.getState().biometricEnabled).toBe(true);
    });
    // Enabling retries the unlock from the gate, which replaces the whole tree.
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'BiometricGate' }] });
    });
  });

  // #1052: the "Enable" label used to be a bare Text with onPress inside a padded
  // button, so a tap on the button's padding did nothing and the user tapped again.
  it('enables from a press anywhere on the button, not only on its label', async () => {
    const { usePinStore } = jest.requireActual('../../../store/pinStore');
    usePinStore.setState({ pinHash: 'hash:1234', hasPin: true, hydrated: true });
    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    const enableButton = await screen.findByTestId('biometric-enroll-enable');
    expect(enableButton.props.accessibilityLabel).toBe('BiometricEnrollEnable');

    fireEvent.press(enableButton);

    await waitFor(() => {
      expect(useBiometricStore.getState().biometricEnabled).toBe(true);
    });
  });

  it('keeps the setting off and explains a device without enrolled biometrics', async () => {
    // The enrolment disappeared between this screen's check and the tap.
    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);
    await screen.findByTestId('biometric-enroll-enable');
    mockIsEnrolledAsync.mockResolvedValue(false);

    fireEvent.press(screen.getByTestId('biometric-enroll-enable'));

    await waitFor(() => {
      expect(screen.getByTestId('error-banner')).toHaveTextContent('BiometricErrorNotEnrolled');
    });
    expect(useBiometricStore.getState().biometricEnabled).toBe(false);
    expect(mockReset).not.toHaveBeenCalled();
  });

  // #1052: the skip used to bounce back to the gate, which saw "not enabled" and
  // re-offered enrollment — directly when there was no PIN, and after the PIN the user
  // had just typed when there was. Only the PIN may be requested here.
  describe('Skip', () => {
    it('sends a user without an app PIN to create one instead of bouncing back to the gate', async () => {
      const { usePinStore } = jest.requireActual('../../../store/pinStore');
      usePinStore.setState({ pinHash: null, hasPin: false, hydrated: true });

      await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);
      const skip = await screen.findByTestId('biometric-enroll-skip');

      fireEvent.press(skip);

      // `replace`, not `reset`: the offer's own stack is the one being replaced, and a reset
      // dispatched after the store write was the action React Navigation dropped (#1116).
      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith('PinSetup');
      });
      expect(mockReset).not.toHaveBeenCalledWith({ index: 0, routes: [{ name: 'BiometricGate' }] });
    });

    it('navigates before recording the decline, so the write cannot steal the navigation', async () => {
      // The defect: `setBiometricPromptSkipped()` re-renders this screen, so a navigation
      // dispatched after it could land on a stack that had already been replaced. The order
      // is the contract — the move is made first, the decline recorded after.
      //
      // The spy lives on the store *state object* the screen reads, and is restored in
      // `finally`: leaving it in place would swallow the decline for every later case.
      const { usePinStore } = jest.requireActual('../../../store/pinStore');
      usePinStore.setState({ pinHash: null, hasPin: false, hydrated: true });
      const order: string[] = [];
      const realSetSkipped = useBiometricStore.getState().setBiometricPromptSkipped;
      useBiometricStore.setState({
        setBiometricPromptSkipped: () => {
          order.push('decline');
          realSetSkipped();
        },
      });
      mockReplace.mockImplementation(() => { order.push('navigate'); });

      try {
        await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);
        fireEvent.press(await screen.findByTestId('biometric-enroll-skip'));

        await waitFor(() => expect(order).toEqual(['navigate', 'decline']));
      } finally {
        useBiometricStore.setState({ setBiometricPromptSkipped: realSetSkipped });
        mockReplace.mockReset();
      }
    });

    it('unlocks straight away with the PIN the user already has (#1052)', async () => {
      // The PIN was just confirmed; sending the user to enter it again for declining an
      // optional shortcut is a pointless extra step.
      const { usePinStore } = jest.requireActual('../../../store/pinStore');
      usePinStore.setState({ pinHash: 'hash:1234', hasPin: true, hydrated: true });

      await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);
      fireEvent.press(await screen.findByTestId('biometric-enroll-skip'));

      await waitFor(() => {
        expect(mockSetUnlocked).toHaveBeenCalled();
        expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
      });
      expect(useBiometricStore.getState().biometricPromptSkipped).toBe(true);
    });

    it('requests the PIN even when biometrics are not available on the device', async () => {
      // Nothing to decline on a device that cannot do it, but the tap must still end the
      // offer: the customer continues to the PIN they do not have yet.
      mockHasHardwareAsync.mockResolvedValue(false);
      const { usePinStore } = jest.requireActual('../../../store/pinStore');
      usePinStore.setState({ pinHash: null, hasPin: false, hydrated: true });

      await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

      fireEvent.press(await screen.findByTestId('biometric-enroll-cannot-offer'));

      await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('PinSetup'));
    });

    it('records the decline and unlocks with the PIN that already exists', async () => {
      // Declining on a device whose PIN was just confirmed goes into the app: the PIN is the
      // lock and it is already satisfied — no second trip to a keypad for an optional
      // shortcut (`unlockAndEnter`, the same path the Skip above takes).
      const { usePinStore } = jest.requireActual('../../../store/pinStore');
      usePinStore.setState({ pinHash: 'hash:1234', hasPin: true, hydrated: true });

      await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);
      fireEvent.press(await screen.findByTestId('biometric-enroll-skip'));

      await waitFor(() => {
        expect(useBiometricStore.getState().biometricPromptSkipped).toBe(true);
      });
      expect(mockSetUnlocked).toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    });
  });
});






