import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { AppNavigator } from '../AppNavigator';

// ─── Navigation mocks ─────────────────────────────────────────────────────────

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    createNativeStackNavigator: () => ({
      Navigator: ({ children }: { children: React.ReactNode }) =>
        React.createElement(View, null, children),
      Screen: ({ component: Component }: { component: React.ComponentType }) =>
        React.createElement(Component),
    }),
  };
});

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

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

jest.mock('../../theme/useAuroraSkin', () => ({
  useAuroraSkin: () => ({ dark: false, ink: '#000', ink2: '#666', hair: '#ccc' }),
}));

jest.mock('../../components/common/GlassScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassScreen: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

// ─── Screen mocks ─────────────────────────────────────────────────────────────

jest.mock('../AuthNavigator', () => ({
  AuthNavigator: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: 'auth-navigator' }, 'Auth');
  },
}));

jest.mock('../MainNavigator', () => ({
  MainNavigator: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: 'main-navigator' }, 'Main');
  },
}));

jest.mock('../OnboardingNavigator', () => ({
  OnboardingNavigator: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: 'onboarding-navigator' }, 'Onboarding');
  },
}));

jest.mock('../../screens/auth/BiometricGateScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    BiometricGateScreen: () =>
      React.createElement(Text, { testID: 'biometric-gate' }, 'BiometricGate'),
  };
});

jest.mock('../../screens/auth/BiometricEnrollScreen', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    BiometricEnrollScreen: () =>
      React.createElement(Text, { testID: 'biometric-enroll' }, 'BiometricEnroll'),
  };
});

// ─── Store mocks ──────────────────────────────────────────────────────────────

let mockIsAuthenticated = false;
let mockNeedsOnboarding = false;
let mockBiometricEnabled = false;
let mockBiometricPromptSkipped = false;

jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn(
    (selector: (s: { isAuthenticated: boolean; needsOnboarding: boolean }) => unknown) =>
      selector({ isAuthenticated: mockIsAuthenticated, needsOnboarding: mockNeedsOnboarding }),
  ),
}));

jest.mock('../../store/biometricStore', () => ({
  useBiometricStore: jest.fn(
    (selector: (s: { biometricEnabled: boolean; biometricPromptSkipped: boolean }) => unknown) =>
      selector({ biometricEnabled: mockBiometricEnabled, biometricPromptSkipped: mockBiometricPromptSkipped }),
  ),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AppNavigator', () => {
  beforeEach(() => {
    mockIsAuthenticated = false;
    mockNeedsOnboarding = false;
    mockBiometricEnabled = false;
    mockBiometricPromptSkipped = false;
  });

  it('renders AuthNavigator when not authenticated', async () => {
    await render(<AppNavigator />);
    expect(screen.getByTestId('auth-navigator')).toBeTruthy();
  });

  it('renders OnboardingNavigator when authenticated and needsOnboarding', async () => {
    mockIsAuthenticated = true;
    mockNeedsOnboarding = true;

    await render(<AppNavigator />);
    expect(screen.getByTestId('onboarding-navigator')).toBeTruthy();
  });

  it('renders MainNavigator when authenticated and no needsOnboarding', async () => {
    mockIsAuthenticated = true;
    mockNeedsOnboarding = false;

    await render(<AppNavigator />);
    expect(screen.getByTestId('main-navigator')).toBeTruthy();
  });

  it('renders BiometricGate when authenticated and biometricEnabled', async () => {
    mockIsAuthenticated = true;
    mockBiometricEnabled = true;

    await render(<AppNavigator />);
    expect(screen.getByTestId('biometric-gate')).toBeTruthy();
  });

  it('renders all authenticated screens together when authenticated', async () => {
    mockIsAuthenticated = true;

    await render(<AppNavigator />);

    expect(screen.getByTestId('biometric-gate')).toBeTruthy();
    expect(screen.getByTestId('biometric-enroll')).toBeTruthy();
    expect(screen.getByTestId('onboarding-navigator')).toBeTruthy();
    expect(screen.getByTestId('main-navigator')).toBeTruthy();
  });
});
