import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LoginScreen } from '../LoginScreen';

// ─── UI infrastructure mocks ─────────────────────────────────────────────────

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

jest.mock('../../../theme/useAuroraSkin', () => ({
  useAuroraSkin: () => ({ dark: false, ink: '#000', ink2: '#666', hair: '#ccc' }),
}));

jest.mock('../../../components/auth/AuthHero', () => ({
  AuthHero: jest.fn(() => null),
}));

jest.mock('../../../components/auth/AuroraField', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return {
    AuroraField: ({
      placeholder, value, onChangeText, secureTextEntry,
    }: {
      placeholder?: string;
      value?: string;
      onChangeText?: (t: string) => void;
      secureTextEntry?: boolean;
    }) =>
      React.createElement(TextInput, {
        testID: placeholder,
        value,
        onChangeText,
        secureTextEntry,
      }),
  };
});

jest.mock('../../../components/auth/AuroraPrimaryButton', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    AuroraPrimaryButton: ({
      label, onPress, loading,
    }: { label: string; onPress: () => void; loading?: boolean }) =>
      loading
        ? React.createElement(Text, { testID: 'loading-indicator' }, 'Loading')
        : React.createElement(
            TouchableOpacity,
            { onPress, testID: label },
            React.createElement(Text, null, label),
          ),
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
  const { Text, View } = require('react-native');
  return {
    HelperText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
    Modal: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
    Portal: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

// ─── Push notification mocks ───────────────────────────────────────────────────

const mockRegisterPushNotificationsAsync = jest.fn();
const mockNotificationGetState = jest.fn();

jest.mock('../../../hooks/usePushNotifications', () => ({
  registerPushNotificationsAsync: (...args: unknown[]) => mockRegisterPushNotificationsAsync(...args),
}));

jest.mock('../../../store/notificationStore', () => ({
  useNotificationStore: Object.assign(
    jest.fn(),
    { getState: () => mockNotificationGetState() },
  ),
}));

// ─── API / store mocks ────────────────────────────────────────────────────────

const mockMobileLogin = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockSetTokens = jest.fn();
const mockSetUser = jest.fn();

jest.mock('../../../api/auth.api', () => ({
  mobileLogin: (...args: unknown[]) => mockMobileLogin(...args),
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn(() => ({
    setTokens: mockSetTokens,
    setUser: mockSetUser,
  })),
}));

jest.mock('../../../i18n', () => ({
  __esModule: true,
  default: { changeLanguage: jest.fn() },
}));

// ─── Sentry mock ─────────────────────────────────────────────────────────────

const mockCaptureError = jest.fn();

jest.mock('../../../monitoring/sentry', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: jest.fn().mockResolvedValue({ success: true }),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
} as unknown as React.ComponentProps<typeof LoginScreen>['navigation'];

// ─── Test helpers ─────────────────────────────────────────────────────────────

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });

const renderScreen = async (queryClient: QueryClient) => {
  await render(
    <QueryClientProvider client={queryClient}>
      <LoginScreen navigation={mockNavigation} />
    </QueryClientProvider>,
  );
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LoginScreen', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    mockMobileLogin.mockReset();
    mockGetCurrentUser.mockReset();
    mockSetTokens.mockReset();
    mockSetUser.mockReset();
    mockNavigate.mockReset();
    mockCaptureError.mockReset();
    mockRegisterPushNotificationsAsync.mockReset();
    mockNotificationGetState.mockReset();
    mockNotificationGetState.mockReturnValue({
      expoPushToken: null,
      setExpoPushToken: jest.fn(),
      setNotificationsEnabled: jest.fn(),
    });
  });

  const fillAndSubmit = async () => {
    await fireEvent.changeText(screen.getByTestId('FieldEmailAddress'), 'user@example.com');
    await fireEvent.changeText(screen.getByTestId('FieldPassword'), 'Passw0rd!');
    await fireEvent.press(screen.getByTestId('ButtonSignIn'));
  };

  it('saves tokens and user on successful login', async () => {
    const mockUser = { id: 'u1', firstName: 'Test', languageCode: 'en' };
    mockMobileLogin.mockResolvedValue({ data: { accessToken: 'at', refreshToken: 'rt' } });
    mockGetCurrentUser.mockResolvedValue({ data: mockUser });

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockSetTokens).toHaveBeenCalledWith('at', 'rt');
      expect(mockSetUser).toHaveBeenCalledWith(mockUser);
    });
  });

  it('navigates to TwoFactor when requiresTwoFactor is true in response data', async () => {
    mockMobileLogin.mockResolvedValue({ data: { requiresTwoFactor: true } });

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('TwoFactor', {
        email: 'user@example.com',
        password: 'Passw0rd!',
      }),
    );
  });

  it('navigates to TwoFactor when requiresTwoFactor is true in error response', async () => {
    mockMobileLogin.mockRejectedValue({
      response: { data: { requiresTwoFactor: true } },
    });

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('TwoFactor', {
        email: 'user@example.com',
        password: 'Passw0rd!',
      }),
    );
  });

  it('shows error when login fails with non-2FA error', async () => {
    mockMobileLogin.mockRejectedValue(new Error('invalid credentials'));

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.queryByText('ErrorInvalidCredentials')).toBeTruthy(),
    );
  });

  it('captures error to Sentry when login mutation fails (non-2FA)', async () => {
    const error = new Error('server error');
    mockMobileLogin.mockRejectedValue(error);

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ screen: 'LoginScreen', action: 'login' }),
      ),
    );
  });

  it('does NOT capture error to Sentry when login redirects to TwoFactor via error response', async () => {
    mockMobileLogin.mockRejectedValue({
      response: { data: { requiresTwoFactor: true } },
    });

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('TwoFactor', expect.any(Object)),
    );
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it('does NOT capture error to Sentry when login redirects to TwoFactor via success response', async () => {
    mockMobileLogin.mockResolvedValue({ data: { requiresTwoFactor: true } });

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('TwoFactor', expect.any(Object)),
    );
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  it('captures error to Sentry when getCurrentUser fails silently', async () => {
    const fetchError = new Error('profile fetch failed');
    mockMobileLogin.mockResolvedValue({ data: { accessToken: 'at', refreshToken: 'rt' } });
    mockGetCurrentUser.mockRejectedValue(fetchError);

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        fetchError,
        expect.objectContaining({ screen: 'LoginScreen', action: 'fetchCurrentUser' }),
      ),
    );
  });

  it('does NOT capture error to Sentry on successful login with profile', async () => {
    mockMobileLogin.mockResolvedValue({ data: { accessToken: 'at', refreshToken: 'rt' } });
    mockGetCurrentUser.mockResolvedValue({ data: { id: 'u1', firstName: '', languageCode: 'en' } });

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() => expect(mockSetTokens).toHaveBeenCalled());
    expect(mockCaptureError).not.toHaveBeenCalled();
  });

  // ─── Push notification registration tests ────────────────────────────────

  it('calls push registration on successful login when no token exists', async () => {
    mockMobileLogin.mockResolvedValue({ data: { accessToken: 'at', refreshToken: 'rt' } });
    mockGetCurrentUser.mockResolvedValue({
      data: { id: 'u1', firstName: 'Test', languageCode: 'en' },
    });
    mockNotificationGetState.mockReturnValue({
      expoPushToken: null,
      setExpoPushToken: jest.fn(),
      setNotificationsEnabled: jest.fn(),
    });

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockSetTokens).toHaveBeenCalled();
      expect(mockRegisterPushNotificationsAsync).toHaveBeenCalled();
    });
  });

  it('skips push registration when token already exists', async () => {
    mockMobileLogin.mockResolvedValue({ data: { accessToken: 'at', refreshToken: 'rt' } });
    mockGetCurrentUser.mockResolvedValue({
      data: { id: 'u1', firstName: 'Test', languageCode: 'en' },
    });
    mockNotificationGetState.mockReturnValue({
      expoPushToken: 'ExponentPushToken[existing]',
      setExpoPushToken: jest.fn(),
      setNotificationsEnabled: jest.fn(),
    });

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockSetTokens).toHaveBeenCalled();
    });
    expect(mockRegisterPushNotificationsAsync).not.toHaveBeenCalled();
  });

  it('does not break login flow when push registration completes', async () => {
    mockMobileLogin.mockResolvedValue({ data: { accessToken: 'at', refreshToken: 'rt' } });
    mockGetCurrentUser.mockResolvedValue({
      data: { id: 'u1', firstName: 'Test', languageCode: 'en' },
    });
    mockRegisterPushNotificationsAsync.mockResolvedValue(undefined);

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() => {
      expect(mockSetTokens).toHaveBeenCalledWith('at', 'rt');
      expect(mockSetUser).toHaveBeenCalled();
    });
  });
});
