import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TwoFactorScreen } from '../TwoFactorScreen';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../../navigation/AuthNavigator';

// ─── UI infrastructure mocks ─────────────────────────────────────────────────

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
      placeholder, value, onChangeText,
    }: {
      placeholder?: string;
      value?: string;
      onChangeText?: (t: string) => void;
    }) =>
      React.createElement(TextInput, {
        testID: placeholder,
        value,
        onChangeText,
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
  const { Text } = require('react-native');
  return {
    HelperText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

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

// ─── Route / navigation mock ─────────────────────────────────────────────────

type TwoFactorProps = NativeStackScreenProps<AuthStackParamList, 'TwoFactor'>;

const mockRoute = {
  params: { email: 'user@example.com', password: 'Passw0rd!' },
  key: 'TwoFactor',
  name: 'TwoFactor',
} as TwoFactorProps['route'];

const mockNavigation = {} as TwoFactorProps['navigation'];

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
      <TwoFactorScreen route={mockRoute} navigation={mockNavigation} />
    </QueryClientProvider>,
  );
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('TwoFactorScreen', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    mockMobileLogin.mockReset();
    mockGetCurrentUser.mockReset();
    mockSetTokens.mockReset();
    mockSetUser.mockReset();
    mockCaptureError.mockReset();
  });

  const fillAndSubmit = async () => {
    await fireEvent.changeText(screen.getByTestId('FieldTwoFactorCode'), '123456');
    await fireEvent.press(screen.getByTestId('ButtonVerify'));
  };

  it('saves tokens and user on successful 2FA verification', async () => {
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

  it('shows error when 2FA verification fails', async () => {
    mockMobileLogin.mockRejectedValue(new Error('invalid code'));

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() =>
      expect(screen.queryByText('ErrorInvalidTwoFactorCode')).toBeTruthy(),
    );
  });

  it('calls mobileLogin with email, password, and 2FA code from route params', async () => {
    mockMobileLogin.mockResolvedValue({ data: { accessToken: 'at', refreshToken: 'rt' } });
    mockGetCurrentUser.mockResolvedValue({ data: { id: 'u1', firstName: '', languageCode: 'en' } });

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() =>
      expect(mockMobileLogin).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'Passw0rd!',
        twoFactorCode: '123456',
      }),
    );
  });

  it('captures error to Sentry when 2FA mutation fails', async () => {
    const error = new Error('invalid 2FA code');
    mockMobileLogin.mockRejectedValue(error);

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ screen: 'TwoFactorScreen', action: 'verifyTwoFactor' }),
      ),
    );
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
        expect.objectContaining({ screen: 'TwoFactorScreen', action: 'fetchCurrentUser' }),
      ),
    );
  });

  it('does NOT capture error to Sentry on successful 2FA with profile', async () => {
    mockMobileLogin.mockResolvedValue({ data: { accessToken: 'at', refreshToken: 'rt' } });
    mockGetCurrentUser.mockResolvedValue({ data: { id: 'u1', firstName: '', languageCode: 'en' } });

    await renderScreen(queryClient);
    await fillAndSubmit();

    await waitFor(() => expect(mockSetTokens).toHaveBeenCalled());
    expect(mockCaptureError).not.toHaveBeenCalled();
  });
});
