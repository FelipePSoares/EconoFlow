import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { BiometricEnrollScreen } from '../BiometricEnrollScreen';
import { useBiometricStore } from '../../../store/biometricStore';

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

const mockReset = jest.fn();
const mockNavigation = {
  reset: mockReset,
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
    mockHasHardwareAsync.mockResolvedValue(true);
    mockIsEnrolledAsync.mockResolvedValue(true);
  });

  it('navigates to BiometricGate when biometricPromptSkipped is true', async () => {
    useBiometricStore.getState().setBiometricPromptSkipped();

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'BiometricGate' }],
      });
    });
  });

  it('navigates to BiometricGate when no biometric hardware', async () => {
    mockHasHardwareAsync.mockResolvedValue(false);

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'BiometricGate' }],
      });
    });
  });

  it('navigates to BiometricGate when not enrolled in biometrics', async () => {
    mockIsEnrolledAsync.mockResolvedValue(false);

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'BiometricGate' }],
      });
    });
  });

  it('navigates to BiometricGate when the hardware query throws', async () => {
    // A rejected native call left the screen blank forever, because `checked` was
    // never set and nothing else could move the user on.
    mockHasHardwareAsync.mockRejectedValue(new Error('native module missing'));

    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'BiometricGate' }],
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
    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByTestId('biometric-enroll-enable').props.accessibilityRole).toBe('button');
    });

    fireEvent.press(screen.getByTestId('biometric-enroll-enable'));

    await waitFor(() => {
      expect(useBiometricStore.getState().biometricEnabled).toBe(true);
    });
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'BiometricGate' }],
      });
    });
  });

  // #1052: the "Enable" label used to be a bare Text with onPress inside a padded
  // button, so a tap on the button's padding did nothing and the user tapped again.
  it('enables from a press anywhere on the button, not only on its label', async () => {
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

  it('calls setBiometricPromptSkipped and navigates to BiometricGate on Skip', async () => {
    await render(<BiometricEnrollScreen navigation={mockNavigation} route={mockRoute} />);

    await waitFor(() => {
      expect(screen.getByTestId('biometric-enroll-skip')).toBeTruthy();
    });

    fireEvent.press(screen.getByTestId('biometric-enroll-skip'));

    await waitFor(() => {
      expect(useBiometricStore.getState().biometricPromptSkipped).toBe(true);
    });
    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: 'BiometricGate' }],
    });
  });
});
