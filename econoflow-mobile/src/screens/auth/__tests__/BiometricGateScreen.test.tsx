import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { BiometricGateScreen } from '../BiometricGateScreen';

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Text: ({ children, onPress, ...props }: Record<string, any>) =>
      React.createElement(RNText, { ...props, onPress }, children),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ActivityIndicator: (props: Record<string, any>) =>
      React.createElement(View, props),
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

// ─── Store mocks ──────────────────────────────────────────────────────────────

jest.mock('../../../store/biometricStore', () => ({
  useBiometricStore: jest.fn().mockReturnValue({
    biometricEnabled: true,
    setBiometricEnabled: jest.fn(),
  }),
}));

const mockClearAuth = jest.fn();
const mockNeedsOnboarding = false;

const authState = { clearAuth: mockClearAuth, needsOnboarding: mockNeedsOnboarding };

jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn((selector?: (s: typeof authState) => unknown) =>
    selector ? selector(authState) : authState,
  ),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockReset = jest.fn();

const mockNavigation = {
  reset: mockReset,
} as unknown as React.ComponentProps<typeof BiometricGateScreen>['navigation'];

const mockRoute = {} as unknown as React.ComponentProps<typeof BiometricGateScreen>['route'];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('BiometricGateScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({
      biometricEnabled: true,
      setBiometricEnabled: jest.fn(),
    });
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
    mockAuthenticateAsync.mockResolvedValue({ success: true });
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
    mockAuthenticateAsync.mockResolvedValue({ success: true });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
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
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });

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
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByTestId('biometric-fallback')).toBeTruthy();
      expect(screen.getByText('BiometricSignOut')).toBeTruthy();
    });
  });

  it('navigates to Auth on sign out', async () => {
    mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'user_cancel' });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByTestId('biometric-fallback')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('BiometricSignOut'));

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    });
  });

  it('does not call authenticate when biometrics are not available', async () => {
    mockHasHardwareAsync.mockResolvedValue(false);

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockAuthenticateAsync).not.toHaveBeenCalled();
    });
  });

  it('does not call authenticate when not enrolled', async () => {
    mockIsEnrolledAsync.mockResolvedValue(false);

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockAuthenticateAsync).not.toHaveBeenCalled();
    });
  });

  it('navigates to BiometricEnroll when biometricEnabled is false', async () => {
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({
      biometricEnabled: false,
      setBiometricEnabled: jest.fn(),
    });

    await render(<BiometricGateScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockAuthenticateAsync).not.toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'BiometricEnroll' }],
      });
    });
  });
});
