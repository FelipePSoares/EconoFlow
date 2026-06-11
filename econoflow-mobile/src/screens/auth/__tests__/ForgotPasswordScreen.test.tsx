import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ForgotPasswordScreen } from '../ForgotPasswordScreen';

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

// ─── API mock ─────────────────────────────────────────────────────────────────

const mockForgotPassword = jest.fn();

jest.mock('../../../api/auth.api', () => ({
  forgotPassword: (...args: unknown[]) => mockForgotPassword(...args),
}));

// ─── Sentry mock ─────────────────────────────────────────────────────────────

const mockCaptureError = jest.fn();

jest.mock('../../../monitoring/sentry', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
} as unknown as React.ComponentProps<typeof ForgotPasswordScreen>['navigation'];

// ─── Test helpers ─────────────────────────────────────────────────────────────

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false, gcTime: 0 },
    },
  });

const renderScreen = (queryClient: QueryClient) =>
  render(
    <QueryClientProvider client={queryClient}>
      <ForgotPasswordScreen navigation={mockNavigation} />
    </QueryClientProvider>,
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ForgotPasswordScreen', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createQueryClient();
    mockForgotPassword.mockReset();
    mockNavigate.mockReset();
    mockCaptureError.mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  const submitForm = async () => {
    fireEvent.changeText(screen.getByTestId('FieldEmailAddress'), 'user@example.com');
    fireEvent.press(screen.getByTestId('ButtonSendResetLink'));
  };

  it('shows success UI when mutation succeeds', async () => {
    mockForgotPassword.mockResolvedValue({});

    renderScreen(queryClient);
    await submitForm();

    await waitFor(() =>
      expect(screen.queryByText('LabelCheckYourEmail')).toBeTruthy(),
    );
  });

  it('shows success UI even when mutation fails (anti-enumeration)', async () => {
    mockForgotPassword.mockRejectedValue(new Error('not found'));

    renderScreen(queryClient);
    await submitForm();

    await waitFor(() =>
      expect(screen.queryByText('LabelCheckYourEmail')).toBeTruthy(),
    );
  });

  it('captures error to Sentry when mutation fails', async () => {
    const error = new Error('server error');
    mockForgotPassword.mockRejectedValue(error);

    renderScreen(queryClient);
    await submitForm();

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ screen: 'ForgotPasswordScreen', action: 'forgotPassword' }),
      ),
    );
  });

  it('does NOT capture error to Sentry when mutation succeeds', async () => {
    mockForgotPassword.mockResolvedValue({});

    renderScreen(queryClient);
    await submitForm();

    await waitFor(() =>
      expect(screen.queryByText('LabelCheckYourEmail')).toBeTruthy(),
    );
    expect(mockCaptureError).not.toHaveBeenCalled();
  });
});
