import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react-native';
import { LockOverlay } from '../LockOverlay';
import { useAuthStore } from '../../../store/authStore';
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

jest.mock('../../common/GlassCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassCard: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement(View, props, children),
  };
});

jest.mock('../../common/GlassScreen', () => {
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
    Text: ({ children, ...props }: Record<string, unknown>) =>
      React.createElement(RNText, props, children),
  };
});

const mockAuthenticateAsync = jest.fn();
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
}));

// Real Zustand stores, so a state change actually re-renders the overlay: the sensor result
// and the biometric flag both drive what is shown.
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn().mockResolvedValue(null),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
  deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async (_algorithm: string, value: string) => `hash:${value}`),
}));

const mockSetUnlocked = jest.fn();
jest.mock('../../../store/lockStore', () => ({
  useLockStore: jest.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { setUnlocked: mockSetUnlocked };
    return selector ? selector(state) : state;
  }),
}));

describe('LockOverlay', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ accessToken: null, refreshToken: null, user: null, isAuthenticated: false });
    useBiometricStore.setState({ biometricEnabled: true, hydrated: true });
    usePinStore.setState({ pinHash: 'hash:1234', hasPin: true, pinLength: 4 });
    mockAuthenticateAsync.mockReset();
    mockAuthenticateAsync.mockResolvedValue({ success: true });
  });

  // The reported symptom (#1052): while the fingerprint dialog is up, the keypad was
  // already underneath it, so the user was asked for both at once.
  it('prompts for biometrics without showing the PIN pad underneath it (#1052)', async () => {
    useAuthStore.setState({
      accessToken: 'at',
      refreshToken: 'rt',
      user: { id: 'user-a', firstName: 'A' } as never,
      isAuthenticated: true,
    });

    await render(<LockOverlay />);

    // The prompt is opened on a task; give it a moment, then assert the keypad is absent.
    await act(async () => {
      await new Promise((resolve) => { setTimeout(resolve, 5); });
    });

    expect(mockAuthenticateAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('pin-keypad')).toBeNull();
  });

  it('shows the PIN pad only once the sensor failed all its attempts', async () => {
    useAuthStore.setState({
      accessToken: 'at',
      refreshToken: 'rt',
      user: { id: 'user-a', firstName: 'A' } as never,
      isAuthenticated: true,
    });
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });

    await render(<LockOverlay />);

    // First failure: the sensor still owns the way in, so no keypad yet.
    const retry = await screen.findByText('BiometricUsePasscode');
    expect(mockAuthenticateAsync).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('pin-keypad')).toBeNull();

    // Each retry is another sensor attempt; the third real failure runs the sensor out.
    await act(async () => {
      fireEvent.press(retry);
    });
    await act(async () => {
      fireEvent.press(screen.getByText('BiometricUsePasscode'));
    });

    // The keypad is the fallback only now, and it offers the way back to the sensor.
    expect(await screen.findByTestId('pin-keypad')).toBeTruthy();
    expect(screen.getByTestId('lock-use-biometric')).toBeTruthy();
  });

  it('never covers the signed-out app (#1052)', async () => {
    // The lock store now starts LOCKED so a relaunch cannot walk past the gate, and this
    // overlay is rendered whenever the lock is on. Without the auth check it painted a PIN
    // pad over the Login screen, so the app asked for a PIN before anyone had signed in.
    await render(<LockOverlay />);

    expect(screen.queryByTestId('lock-overlay')).toBeNull();
  });

  it('covers a signed-in session', async () => {
    useAuthStore.setState({
      accessToken: 'at',
      refreshToken: 'rt',
      user: { id: 'user-a', firstName: 'A' } as never,
      isAuthenticated: true,
    });

    await render(<LockOverlay />);

    expect(screen.getByTestId('lock-overlay')).toBeTruthy();
  });
});
