import React from 'react';
import { Linking } from 'react-native';
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

jest.mock('../../../theme/useAppTheme', () => ({
  // The security row takes its icon colour from the app theme, so the mock has to
  // provide the palette the real hook returns.
  useAppTheme: () => ({ colors: { primary: '#0f76a8' } }),
}));

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

jest.mock('../../../components/common/ErrorBanner', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  return {
    // Mirrors the real banner's shape closely enough to assert on visible/message
    // and to drive both actions from a test.
    ErrorBanner: ({
      visible, message, onDismiss, onRetry,
    }: {
      visible: boolean;
      message?: string;
      onDismiss: () => void;
      onRetry?: () => void;
    }) => {
      if (!visible) return null;
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(Text, { testID: 'error-banner' }, message ?? 'ErrorGeneric'),
        onRetry
          ? React.createElement(TouchableOpacity, { testID: 'error-banner-retry', onPress: onRetry })
          : null,
        React.createElement(TouchableOpacity, { testID: 'error-banner-dismiss', onPress: onDismiss }),
      );
    },
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
const mockSyncPermissionState = jest.fn();
const mockOpenNotificationSettings = jest.fn();
const mockRequestNotificationPermissionAndRegister = jest.fn();

jest.mock('../../../hooks/usePushNotifications', () => ({
  usePushNotifications: jest.fn(() => ({
    notificationsEnabled: false,
    registerPushNotifications: mockRegisterPushNotifications,
    unregisterPushNotifications: mockUnregisterPushNotifications,
    syncPermissionState: mockSyncPermissionState,
  })),
  // #1053: turning the toggle on goes through the shared flow so the OS prompt is
  // asked at most once and the Android channel exists before the dialog appears.
  requestNotificationPermissionAndRegister: (...args: unknown[]) =>
    mockRequestNotificationPermissionAndRegister(...args),
  openNotificationSettings: (...args: unknown[]) => mockOpenNotificationSettings(...args),
}));

jest.mock('../../../store/notificationStore', () => ({
  useNotificationStore: jest.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      lastPermissionError: null as string | null,
      setLastPermissionError: jest.fn(),
    };
    return selector ? selector(state) : state;
  }),
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

  it('goes through the shared permission flow when turned on (#1053)', async () => {
    const { usePushNotifications } = jest.requireMock('../../../hooks/usePushNotifications');
    usePushNotifications.mockReturnValue({
      syncPermissionState: mockSyncPermissionState,
      notificationsEnabled: false,
      registerPushNotifications: mockRegisterPushNotifications,
      unregisterPushNotifications: mockUnregisterPushNotifications,
    });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-PushNotifications'));
    expect(mockRequestNotificationPermissionAndRegister).toHaveBeenCalled();
  });

  it('calls unregisterPushNotifications when toggled off', async () => {
    const { usePushNotifications } = jest.requireMock('../../../hooks/usePushNotifications');
    usePushNotifications.mockReturnValue({
      syncPermissionState: mockSyncPermissionState,
      notificationsEnabled: true,
      registerPushNotifications: mockRegisterPushNotifications,
      unregisterPushNotifications: mockUnregisterPushNotifications,
    });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-PushNotifications'));
    expect(mockUnregisterPushNotifications).toHaveBeenCalled();
  });
});

describe('ProfileScreen – push notifications loading state', () => {
  beforeEach(() => {
    mockRegisterPushNotifications.mockReset();
    mockUnregisterPushNotifications.mockReset();
  });

  const mockHook = (overrides: Record<string, unknown>) => {
    const { usePushNotifications } = jest.requireMock('../../../hooks/usePushNotifications');
    usePushNotifications.mockReturnValue({
      syncPermissionState: mockSyncPermissionState,
      notificationsEnabled: false,
      isRegistering: false,
      isUnregistering: false,
      registerPushNotifications: mockRegisterPushNotifications,
      unregisterPushNotifications: mockUnregisterPushNotifications,
      ...overrides,
    });
  };

  it('shows a spinner while notifications are being enabled (#1054)', async () => {
    mockHook({ isRegistering: true });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByTestId('row-PushNotifications-spinner')).toBeTruthy();
  });

  it('shows a spinner while notifications are being disabled (#1054)', async () => {
    mockHook({ notificationsEnabled: true, isUnregistering: true });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByTestId('row-PushNotifications-spinner')).toBeTruthy();
  });

  it('does not show a spinner when no notification request is in flight', async () => {
    mockHook({ pushNotificationsError: null });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.queryByTestId('row-PushNotifications-spinner')).toBeNull();
  });

  it('marks the row busy for screen readers while a request is in flight', async () => {
    mockHook({ isRegistering: true });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByTestId('row-PushNotifications').props.accessibilityState).toEqual(
      expect.objectContaining({ busy: true, disabled: true }),
    );
  });

  it('ignores presses on the row while unregistering (#1054)', async () => {
    mockHook({ notificationsEnabled: true, isUnregistering: true });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-PushNotifications'));

    expect(mockUnregisterPushNotifications).not.toHaveBeenCalled();
    expect(mockRegisterPushNotifications).not.toHaveBeenCalled();
  });
});

describe('ProfileScreen – push notifications error banner (#1056)', () => {
  const mockClearPushNotificationsError = jest.fn();
  const mockRetryPushNotificationsRegistration = jest.fn();

  beforeEach(() => {
    mockRegisterPushNotifications.mockReset();
    mockUnregisterPushNotifications.mockReset();
    mockClearPushNotificationsError.mockReset();
    mockRetryPushNotificationsRegistration.mockReset();
  });

  const mockHook = (overrides: Record<string, unknown>) => {
    const { usePushNotifications } = jest.requireMock('../../../hooks/usePushNotifications');
    usePushNotifications.mockReturnValue({
      syncPermissionState: mockSyncPermissionState,
      notificationsEnabled: false,
      isRegistering: false,
      isUnregistering: false,
      registerPushNotifications: mockRegisterPushNotifications,
      unregisterPushNotifications: mockUnregisterPushNotifications,
      clearPushNotificationsError: mockClearPushNotificationsError,
      retryPushNotificationsRegistration: mockRetryPushNotificationsRegistration,
      ...overrides,
    });
  };

  it('shows the localised permission message when notifications are blocked', async () => {
    mockHook({ pushNotificationsError: 'permission' });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByTestId('error-banner')).toHaveTextContent('NotificationsPermissionBlockedMessage');
  });

  it('shows a retry-later message for a technical failure', async () => {
    mockHook({ pushNotificationsError: 'api' });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByTestId('error-banner')).toHaveTextContent('NotificationsEnableFailedMessage');
  });

  it('explains that push is unavailable in Expo Go on Android', async () => {
    mockHook({ pushNotificationsError: 'unavailable' });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByTestId('error-banner')).toHaveTextContent('NotificationsUnavailableExpoGoMessage');
  });

  it('says a physical device is required when running on a simulator', async () => {
    mockHook({ pushNotificationsError: 'device' });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByTestId('error-banner')).toHaveTextContent('NotificationsRequirePhysicalDeviceMessage');
  });

  it('does not render the banner when there is no error', async () => {
    mockHook({ pushNotificationsError: null });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.queryByTestId('error-banner')).toBeNull();
  });

  it('re-runs the activation when the retry action is pressed', async () => {
    mockHook({ pushNotificationsError: 'api' });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('error-banner-retry'));

    expect(mockRetryPushNotificationsRegistration).toHaveBeenCalledTimes(1);
  });

  it('clears the error when dismissed', async () => {
    mockHook({ pushNotificationsError: 'api' });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('error-banner-dismiss'));

    expect(mockClearPushNotificationsError).toHaveBeenCalledTimes(1);
  });

  it('shows a distinct message when disabling notifications fails', async () => {
    mockHook({ notificationsEnabled: true, pushNotificationsError: 'unregister' });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('NotificationsDisableFailedMessage')).toBeTruthy();
    expect(screen.queryByTestId('error-banner-retry')).toBeNull();
  });
});

describe('ProfileScreen – notifications permission sync (#1053)', () => {
  beforeEach(() => {
    mockRegisterPushNotifications.mockReset();
    mockUnregisterPushNotifications.mockReset();
    mockSyncPermissionState.mockReset();
    mockSyncPermissionState.mockResolvedValue(undefined);
    mockOpenNotificationSettings.mockReset();
    mockRequestNotificationPermissionAndRegister.mockReset();
    mockRequestNotificationPermissionAndRegister.mockResolvedValue({ ok: true });
  });

  const mockHook = (overrides: Record<string, unknown>) => {
    const { usePushNotifications } = jest.requireMock('../../../hooks/usePushNotifications');
    usePushNotifications.mockReturnValue({
      syncPermissionState: mockSyncPermissionState,
      notificationsEnabled: false,
      isRegistering: false,
      isUnregistering: false,
      registerPushNotifications: mockRegisterPushNotifications,
      unregisterPushNotifications: mockUnregisterPushNotifications,
      ...overrides,
    });
  };

  afterEach(() => {
    const { usePushNotifications } = jest.requireMock('../../../hooks/usePushNotifications');
    usePushNotifications.mockReturnValue({
      syncPermissionState: mockSyncPermissionState,
      notificationsEnabled: false,
      registerPushNotifications: mockRegisterPushNotifications,
      unregisterPushNotifications: mockUnregisterPushNotifications,
    });
  });

  it('re-reads the OS permission when the screen mounts', async () => {
    mockHook({});

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(mockSyncPermissionState).toHaveBeenCalledTimes(1);
  });

  it('goes through the shared permission flow when turning the toggle on', async () => {
    mockHook({ notificationsEnabled: false });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-PushNotifications'));

    expect(mockRequestNotificationPermissionAndRegister).toHaveBeenCalledTimes(1);
    expect(mockRegisterPushNotifications).not.toHaveBeenCalled();
  });

  it('does not go through the shared flow when turning the toggle off', async () => {
    mockHook({ notificationsEnabled: true });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-PushNotifications'));

    expect(mockRequestNotificationPermissionAndRegister).not.toHaveBeenCalled();
    expect(mockUnregisterPushNotifications).toHaveBeenCalledTimes(1);
  });

  it('shows the settings guidance when the OS blocks notifications for good', async () => {
    mockHook({ pushPermissionStatus: 'denied', canAskForPermission: false });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByTestId('notifications-permission-guidance'))
      .toHaveTextContent(/NotificationsPermissionBlockedGuidance/);
  });

  it('hides the retry banner when the settings guidance already explains the fix', async () => {
    // Two copies of "allow notifications in your settings" side by side is noise.
    const { useNotificationStore } = jest.requireMock('../../../store/notificationStore');
    useNotificationStore.mockImplementation((selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { lastPermissionError: 'api', setLastPermissionError: jest.fn() };
      return selector ? selector(state) : state;
    });
    mockHook({ pushPermissionStatus: 'denied', canAskForPermission: false });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByTestId('notifications-permission-guidance')).toBeTruthy();
    expect(screen.queryByTestId('error-banner')).toBeNull();
  });

  it('opens the system settings from the guidance', async () => {
    mockHook({ pushPermissionStatus: 'denied', canAskForPermission: false });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('notifications-open-settings'));

    expect(mockOpenNotificationSettings).toHaveBeenCalledTimes(1);
  });

  it('hides the guidance while the permission can still be requested in-app', async () => {
    mockHook({ pushPermissionStatus: 'undetermined', canAskForPermission: true });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.queryByTestId('notifications-permission-guidance')).toBeNull();
  });

  it('hides the guidance once the permission is granted', async () => {
    mockHook({ notificationsEnabled: true, pushPermissionStatus: 'granted', canAskForPermission: false });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.queryByTestId('notifications-permission-guidance')).toBeNull();
  });

  it('reports a failure through the error banner when the shared flow fails', async () => {
    mockHook({});
    // The shared flow reports its failure next to the permission state, so a run started
    // by the post-login prompt is still explained on this screen.
    const { useNotificationStore } = jest.requireMock('../../../store/notificationStore');
    useNotificationStore.mockImplementation((selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { lastPermissionError: 'api', setLastPermissionError: jest.fn() };
      return selector ? selector(state) : state;
    });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByTestId('error-banner')).toHaveTextContent('NotificationsEnableFailedMessage');
  });

  it('does not show an error banner when the user declines the OS prompt', async () => {
    mockHook({});
    // A decline stores `permission` as the last outcome; the toggle stays OFF and the
    // banner must not call it an error.
    const { useNotificationStore } = jest.requireMock('../../../store/notificationStore');
    useNotificationStore.mockImplementation((selector?: (s: Record<string, unknown>) => unknown) => {
      const state = { lastPermissionError: 'permission', setLastPermissionError: jest.fn() };
      return selector ? selector(state) : state;
    });

    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-PushNotifications'));

    await waitFor(() => expect(mockRequestNotificationPermissionAndRegister).toHaveBeenCalled());
    expect(screen.queryByTestId('error-banner')).toBeNull();
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

describe('ProfileScreen – security and support', () => {
  const securityPageUrl = 'https://econoflow.pt/security';
  let openUrlSpy: jest.SpyInstance;

  beforeEach(() => {
    openUrlSpy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true as never);
  });

  afterEach(() => {
    openUrlSpy.mockRestore();
  });

  it('renders the security and support row', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByTestId('row-SecurityAndSupport')).toBeTruthy();
  });

  it('opens the published security page when the row is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-SecurityAndSupport'));
    expect(openUrlSpy).toHaveBeenCalledTimes(1);
    expect(openUrlSpy).toHaveBeenCalledWith(securityPageUrl);
  });
});
