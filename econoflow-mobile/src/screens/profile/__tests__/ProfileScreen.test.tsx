import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileScreen } from '../ProfileScreen';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

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
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement(Text, props, children),
  };
});

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('../../../theme/useAuroraSkin', () => ({
  useAuroraSkin: () => ({ dark: false, ink: '#000', ink2: '#666', hair: '#ccc' }),
}));

jest.mock('../../../components/common/GlassScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassScreen: ({ children }: { children: React.ReactNode }) =>
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

const mockRegisterPushNotifications = jest.fn();
const mockUnregisterPushNotifications = jest.fn();

jest.mock('../../../hooks/usePushNotifications', () => ({
  usePushNotifications: jest.fn(() => ({
    notificationsEnabled: false,
    registerPushNotifications: mockRegisterPushNotifications,
    unregisterPushNotifications: mockUnregisterPushNotifications,
  })),
}));

jest.mock('../../../store/notificationStore', () => ({
  useNotificationStore: jest.fn(() => ({
    expoPushToken: null,
    notificationsEnabled: false,
  })),
}));

const mockClearAuth = jest.fn();
const mockClearProject = jest.fn();
const mockQueryClientClear = jest.fn();
const mockClearPin = jest.fn();
const mockResetLock = jest.fn();

jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    user: {
      id: 'u1',
      email: 'alice@example.com',
      firstName: 'Alice',
      lastName: 'Smith',
      fullName: 'Alice Smith',
      enabled: true,
      isFirstLogin: false,
      emailConfirmed: true,
      twoFactorEnabled: false,
      defaultProjectId: null,
      notificationChannels: [],
      languageCode: 'en',
      isBetaTester: false,
    },
    clearAuth: mockClearAuth,
  })),
}));

jest.mock('../../../store/biometricStore', () => ({
  useBiometricStore: jest.fn(() => ({
    biometricEnabled: false,
    setBiometricEnabled: jest.fn(),
    resetBiometricPromptSkipped: jest.fn(),
  })),
}));

jest.mock('../../../store/pinStore', () => ({
  usePinStore: jest.fn((selector?: (s: { hasPin: boolean; clearPin: typeof mockClearPin }) => unknown) => {
    const state = { hasPin: false, clearPin: mockClearPin };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('../../../store/lockStore', () => ({
  useLockStore: jest.fn((selector?: (s: { reset: typeof mockResetLock }) => unknown) => {
    const state = { reset: mockResetLock };
    return selector ? selector(state) : state;
  }),
}));

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(() => ({
    selectedProject: null,
    clearProject: mockClearProject,
  })),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(() => ({ clear: mockQueryClientClear })),
}));

jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  return {
    ...actual,
    useNavigation: jest.fn(() => ({ navigate: jest.fn() })),
  };
});

const mockNavigate = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
} as unknown as React.ComponentProps<typeof ProfileScreen>['navigation'];

const mockRoute = {} as unknown as React.ComponentProps<typeof ProfileScreen>['route'];

describe('ProfileScreen – sign out', () => {
  beforeEach(() => {
    mockClearAuth.mockReset();
    mockClearProject.mockReset();
    mockQueryClientClear.mockReset();
    mockClearPin.mockReset();
    mockResetLock.mockReset();
    mockNavigate.mockReset();
    mockRegisterPushNotifications.mockReset();
    mockUnregisterPushNotifications.mockReset();
  });

  it('calls clearAuth when the sign-out button is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByText('ButtonSignOut'));
    await waitFor(() => {
      expect(mockClearAuth).toHaveBeenCalledTimes(1);
    });
  });

  it('calls clearProject when the sign-out button is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByText('ButtonSignOut'));
    await waitFor(() => {
      expect(mockClearProject).toHaveBeenCalledTimes(1);
    });
  });

  it('clears the React Query cache when the sign-out button is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByText('ButtonSignOut'));
    await waitFor(() => {
      expect(mockQueryClientClear).toHaveBeenCalledTimes(1);
    });
  });

  it('calls unregisterPushNotifications when the sign-out button is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByText('ButtonSignOut'));
    await waitFor(() => {
      expect(mockUnregisterPushNotifications).toHaveBeenCalledTimes(1);
    });
  });

  it('calls clearPin and resetLock when the sign-out button is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByText('ButtonSignOut'));
    await waitFor(() => {
      expect(mockClearPin).toHaveBeenCalledTimes(1);
      expect(mockResetLock).toHaveBeenCalledTimes(1);
    });
  });
});

describe('ProfileScreen – row navigation', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('navigates to EditName when the edit-name row is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-EditName'));
    expect(mockNavigate).toHaveBeenCalledWith('EditName');
  });

  it('navigates to ChangePassword when the change-password row is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-ChangePassword'));
    expect(mockNavigate).toHaveBeenCalledWith('ChangePassword');
  });

  it('navigates to ChangeEmail when the change-email row is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-ChangeEmail'));
    expect(mockNavigate).toHaveBeenCalledWith('ChangeEmail');
  });

  it('navigates to LanguagePicker when the language row is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-LanguagePicker'));
    expect(mockNavigate).toHaveBeenCalledWith('LanguagePicker');
  });

  it('navigates to TwoFactorSetup when the Authenticator App row is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-AuthenticatorApp'));
    expect(mockNavigate).toHaveBeenCalledWith('TwoFactorSetup');
  });
});

describe('ProfileScreen – push notifications toggle', () => {
  beforeEach(() => {
    mockRegisterPushNotifications.mockReset();
    mockUnregisterPushNotifications.mockReset();
    mockClearAuth.mockReset();
    mockClearProject.mockReset();
    mockQueryClientClear.mockReset();
  });

  it('renders the push notifications toggle row', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByTestId('row-PushNotifications')).toBeTruthy();
  });

  it('calls registerPushNotifications when toggled on', async () => {
    const { usePushNotifications } = jest.requireMock('../../../hooks/usePushNotifications');
    usePushNotifications.mockReturnValue({
      notificationsEnabled: false,
      registerPushNotifications: mockRegisterPushNotifications,
      unregisterPushNotifications: mockUnregisterPushNotifications,
    });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-PushNotifications'));
    expect(mockRegisterPushNotifications).toHaveBeenCalled();
  });

  it('calls unregisterPushNotifications when toggled off', async () => {
    const { usePushNotifications } = jest.requireMock('../../../hooks/usePushNotifications');
    usePushNotifications.mockReturnValue({
      notificationsEnabled: true,
      registerPushNotifications: mockRegisterPushNotifications,
      unregisterPushNotifications: mockUnregisterPushNotifications,
    });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-PushNotifications'));
    expect(mockUnregisterPushNotifications).toHaveBeenCalled();
  });
});

describe('ProfileScreen – biometric toggle', () => {
  const mockSetBiometricEnabled = jest.fn();

  beforeEach(() => {
    mockSetBiometricEnabled.mockReset();
  });

  it('renders the biometric toggle row', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByTestId('row-BiometricAuth')).toBeTruthy();
  });

  it('calls setBiometricEnabled when toggled', async () => {
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({
      biometricEnabled: false,
      setBiometricEnabled: mockSetBiometricEnabled,
      resetBiometricPromptSkipped: jest.fn(),
    });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-BiometricAuth'));
    expect(mockSetBiometricEnabled).toHaveBeenCalledWith(true);
  });

  it('shows toggled on when biometricEnabled is true', async () => {
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({
      biometricEnabled: true,
      setBiometricEnabled: mockSetBiometricEnabled,
      resetBiometricPromptSkipped: jest.fn(),
    });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-BiometricAuth'));
    expect(mockSetBiometricEnabled).toHaveBeenCalledWith(false);
  });

  it('calls resetBiometricPromptSkipped when toggling biometrics on', async () => {
    const mockResetPromptSkipped = jest.fn();
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({
      biometricEnabled: false,
      setBiometricEnabled: jest.fn(),
      resetBiometricPromptSkipped: mockResetPromptSkipped,
    });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-BiometricAuth'));
    expect(mockResetPromptSkipped).toHaveBeenCalled();
  });

  it('does not call resetBiometricPromptSkipped when toggling biometrics off', async () => {
    const mockResetPromptSkipped = jest.fn();
    const { useBiometricStore } = jest.requireMock('../../../store/biometricStore');
    useBiometricStore.mockReturnValue({
      biometricEnabled: true,
      setBiometricEnabled: jest.fn(),
      resetBiometricPromptSkipped: mockResetPromptSkipped,
    });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-BiometricAuth'));
    expect(mockResetPromptSkipped).not.toHaveBeenCalled();
  });
});

describe('ProfileScreen – PIN settings', () => {
  it('renders the change PIN row', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByTestId('row-ChangePin')).toBeTruthy();
  });
});
