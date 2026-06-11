import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RegisterScreen } from '../RegisterScreen';

// ─── UI infrastructure mocks ─────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

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
  const { Text } = require('react-native');
  return {
    HelperText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

jest.mock('react-native/Libraries/Linking/Linking', () => ({
  openURL: jest.fn(),
}));

// ─── API / store mocks ────────────────────────────────────────────────────────

const mockRegister = jest.fn();
const mockMobileLogin = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockSetTokens = jest.fn();
const mockSetUser = jest.fn();

jest.mock('../../../api/auth.api', () => ({
  register: (...args: unknown[]) => mockRegister(...args),
  mobileLogin: (...args: unknown[]) => mockMobileLogin(...args),
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

// ─── Sentry mock ─────────────────────────────────────────────────────────────

const mockCaptureError = jest.fn();

jest.mock('../../../monitoring/sentry', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
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

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
} as unknown as React.ComponentProps<typeof RegisterScreen>['navigation'];

// ─── Test helpers ─────────────────────────────────────────────────────────────

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });

const renderScreen = async (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <RegisterScreen navigation={mockNavigation} />
    </QueryClientProvider>,
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('RegisterScreen — auto-login after registration', () => {
  let queryClient: QueryClient;

  afterEach(() => {
    queryClient.clear();
  });

  beforeEach(() => {
    queryClient = createQueryClient();
    mockRegister.mockReset();
    mockMobileLogin.mockReset();
    mockGetCurrentUser.mockReset();
    mockSetTokens.mockReset();
    mockSetUser.mockReset();
    mockNavigate.mockReset();
    mockCaptureError.mockReset();
  });

  const fillAndSubmitForm = async () => {
    await fireEvent.changeText(screen.getByTestId('FieldEmailAddress'), 'user@example.com');
    await fireEvent.changeText(screen.getByTestId('FieldPassword'), 'Passw0rd!');
    await fireEvent.changeText(screen.getByTestId('FieldConfirmPassword'), 'Passw0rd!');
    await fireEvent.press(screen.getByTestId('ButtonRegister'));
  };

  it('does not show a "Check your email" success state after registration', async () => {
    mockRegister.mockResolvedValue({ data: {} });
    mockMobileLogin.mockResolvedValue({ data: { accessToken: 'at', refreshToken: 'rt' } });
    mockGetCurrentUser.mockResolvedValue({ data: { id: 'u1', firstName: '', languageCode: 'en' } });

    await renderScreen(queryClient);
    await fillAndSubmitForm();

    await waitFor(() => expect(mockMobileLogin).toHaveBeenCalled());
    expect(screen.queryByText('LabelCheckYourEmail')).toBeNull();
  });

  it('calls mobileLogin with the same credentials after successful registration', async () => {
    mockRegister.mockResolvedValue({ data: {} });
    mockMobileLogin.mockResolvedValue({ data: { accessToken: 'at', refreshToken: 'rt' } });
    mockGetCurrentUser.mockResolvedValue({ data: { id: 'u1', firstName: '', languageCode: 'en' } });

    await renderScreen(queryClient);
    await fillAndSubmitForm();

    await waitFor(() =>
      expect(mockMobileLogin).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'Passw0rd!',
      }),
    );
  });

  it('saves tokens and user when auto-login succeeds', async () => {
    const mockUser = { id: 'u1', firstName: '', languageCode: 'en' };
    mockRegister.mockResolvedValue({ data: {} });
    mockMobileLogin.mockResolvedValue({ data: { accessToken: 'at', refreshToken: 'rt' } });
    mockGetCurrentUser.mockResolvedValue({ data: mockUser });

    await renderScreen(queryClient);
    await fillAndSubmitForm();

    await waitFor(() => {
      expect(mockSetTokens).toHaveBeenCalledWith('at', 'rt');
      expect(mockSetUser).toHaveBeenCalledWith(mockUser);
    });
  });

  it('navigates to TwoFactor when auto-login returns requiresTwoFactor', async () => {
    mockRegister.mockResolvedValue({ data: {} });
    mockMobileLogin.mockResolvedValue({ data: { requiresTwoFactor: true } });

    await renderScreen(queryClient);
    await fillAndSubmitForm();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('TwoFactor', {
        email: 'user@example.com',
        password: 'Passw0rd!',
      }),
    );
  });

  it('shows error banner with sign-in link when auto-login fails', async () => {
    mockRegister.mockResolvedValue({ data: {} });
    mockMobileLogin.mockRejectedValue(new Error('server error'));

    await renderScreen(queryClient);
    await fillAndSubmitForm();

    await waitFor(() => expect(screen.queryByText('ErrorAutoLoginFailed')).toBeTruthy());
    expect(screen.queryByText('ButtonSignIn')).toBeTruthy();
  });

  it('shows registration error when register API call fails', async () => {
    mockRegister.mockRejectedValue(new Error('server error'));

    await renderScreen(queryClient);
    await fillAndSubmitForm();

    await waitFor(() => expect(screen.queryByText('ErrorRegistrationFailed')).toBeTruthy());
  });

  it('captures error to Sentry when register API call fails', async () => {
    const error = new Error('network error');
    mockRegister.mockRejectedValue(error);

    await renderScreen(queryClient);
    await fillAndSubmitForm();

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ screen: 'RegisterScreen', action: 'register' }),
      ),
    );
  });

  it('captures error to Sentry when auto-login fails after registration', async () => {
    const error = new Error('login failed');
    mockRegister.mockResolvedValue({ data: {} });
    mockMobileLogin.mockRejectedValue(error);

    await renderScreen(queryClient);
    await fillAndSubmitForm();

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ screen: 'RegisterScreen', action: 'autoLogin' }),
      ),
    );
  });

  it('does not capture error to Sentry when auto-login redirects to TwoFactor', async () => {
    mockRegister.mockResolvedValue({ data: {} });
    mockMobileLogin.mockResolvedValue({ data: { requiresTwoFactor: true } });

    await renderScreen(queryClient);
    await fillAndSubmitForm();

    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('TwoFactor', expect.any(Object)),
    );
    expect(mockCaptureError).not.toHaveBeenCalled();
  });
});
