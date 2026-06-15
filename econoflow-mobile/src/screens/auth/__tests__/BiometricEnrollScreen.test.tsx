import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { BiometricEnrollScreen } from '../BiometricEnrollScreen';

// ─── UI infrastructure mocks ─────────────────────────────────────────────────

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

// ─── Expo LocalAuthentication mock ────────────────────────────────────────────

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

// ─── Biometric store mock ────────────────────────────────────────────────────

jest.mock('../../../store/biometricStore', () => ({
  useBiometricStore: jest.fn().mockReturnValue({
    biometricEnabled: false,
    biometricPromptSkipped: false,
    setBiometricEnabled: jest.fn(),
    setBiometricPromptSkipped: jest.fn(),
  }),
}));

// ─── Auth store mock ─────────────────────────────────────────────────────────

jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn().mockReturnValue({
    needsOnboarding: false,
  }),
}));

// ─── Navigation mock ─────────────────────────────────────────────────────────

const mockReset = jest.fn();

const mockNavigation = {
  reset: mockReset,
} as unknown as React.ComponentProps<typeof BiometricEnrollScreen>['navigation'];

const mockRoute = {} as unknown as React.ComponentProps<typeof BiometricEnrollScreen>['route'];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BiometricEnrollScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({
      biometricEnabled: false,
      biometricPromptSkipped: false,
      setBiometricEnabled: jest.fn(),
      setBiometricPromptSkipped: jest.fn(),
    });
    const { useAuthStore } = jest.requireMock('../../../store/authStore');
    useAuthStore.mockReturnValue({ needsOnboarding: false });
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
  });

  it('navigates to Main when biometricPromptSkipped is true', async () => {
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({
      biometricEnabled: false,
      biometricPromptSkipped: true,
      setBiometricEnabled: jest.fn(),
      setBiometricPromptSkipped: jest.fn(),
    });

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    });
  });

  it('navigates to Onboarding when needsOnboarding is true and no hardware', async () => {
    const { useAuthStore } = jest.requireMock('../../../store/authStore');
    useAuthStore.mockReturnValue({ needsOnboarding: true });
    mockHasHardwareAsync.mockResolvedValue(false);

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Onboarding' }],
      });
    });
  });

  it('navigates to Main when no biometric hardware', async () => {
    mockHasHardwareAsync.mockResolvedValue(false);

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    });
  });

  it('navigates to Main when not enrolled in biometrics', async () => {
    mockIsEnrolledAsync.mockResolvedValue(false);

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    });
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
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    const mockState = useBiometricStore();

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('BiometricEnrollEnable')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('BiometricEnrollEnable'));

    expect(mockState.setBiometricEnabled).toHaveBeenCalledWith(true);
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'BiometricGate' }],
    });
  });

  it('calls setBiometricPromptSkipped and navigates to Main on Skip', async () => {
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    const mockState = useBiometricStore();

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByText('BiometricEnrollSkip')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('BiometricEnrollSkip'));

    expect(mockState.setBiometricPromptSkipped).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  });
});
