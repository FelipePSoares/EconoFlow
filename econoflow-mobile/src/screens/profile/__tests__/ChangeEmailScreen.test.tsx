import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ChangeEmailScreen } from '../ChangeEmailScreen';

// ─── Sentry mock ──────────────────────────────────────────────────────────────

const mockCaptureError = jest.fn();
jest.mock('../../../monitoring/sentry', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

// ─── UI infrastructure mocks ─────────────────────────────────────────────────

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
    HelperText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
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
  const { Text } = require('react-native');
  return {
    ErrorBanner: ({ visible, message }: { visible: boolean; message?: string }) =>
      visible
        ? React.createElement(Text, { testID: 'error-banner' }, message ?? 'Error')
        : null,
  };
});

jest.mock('../../../components/auth/AuroraField', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return {
    AuroraField: ({ testID, placeholder, value, onChangeText }: {
      testID?: string;
      placeholder?: string;
      value?: string;
      onChangeText?: (t: string) => void;
    }) =>
      React.createElement(TextInput, {
        testID: testID ?? placeholder,
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
      label, onPress, loading, testID,
    }: { label: string; onPress: () => void; loading?: boolean; testID?: string }) =>
      loading
        ? React.createElement(Text, { testID: 'loading-indicator' }, 'Loading')
        : React.createElement(
            TouchableOpacity,
            { onPress, testID: testID ?? label },
            React.createElement(Text, null, label),
          ),
  };
});

// ─── Store / hook mocks ───────────────────────────────────────────────────────

const mockMutateAsync = jest.fn();

jest.mock('../../../hooks/useProfile', () => ({
  useChangeEmail: jest.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

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
  })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockGoBack = jest.fn();
const mockNavigation = {
  goBack: mockGoBack,
} as unknown as React.ComponentProps<typeof ChangeEmailScreen>['navigation'];

const mockRoute = {} as unknown as React.ComponentProps<typeof ChangeEmailScreen>['route'];

// ─── Helpers — capture element refs BEFORE entering act() ────────────────────

async function changeText(testID: string, value: string) {
  const el = screen.getByTestId(testID);
  await act(async () => { el.props.onChangeText(value); });
}

async function pressButton(testID: string) {
  fireEvent.press(screen.getByTestId(testID));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChangeEmailScreen', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    // Default: never resolve — prevents accidental success state
    mockMutateAsync.mockImplementation(() => new Promise(() => {}));
    mockGoBack.mockReset();
    mockCaptureError.mockReset();
  });

  it('pre-fills the email field with the current user email', async () => {
    await render(<ChangeEmailScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByTestId('PlaceholderEmailAddress').props.value).toBe('alice@example.com');
  });

  it('shows required field error when email is cleared on submit', async () => {
    await render(<ChangeEmailScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderEmailAddress', '');
    await pressButton('ButtonSave');
    await waitFor(() => { expect(screen.getByText('RequiredField')).toBeTruthy(); });
  });

  it('shows invalid email format error for malformed email', async () => {
    await render(<ChangeEmailScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderEmailAddress', 'not-an-email');
    await pressButton('ButtonSave');
    await waitFor(() => { expect(screen.getByText('InvalidEmailFormat')).toBeTruthy(); });
  });

  it('calls useChangeEmail.mutateAsync with the new email', async () => {
    mockMutateAsync.mockResolvedValue({});
    await render(<ChangeEmailScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderEmailAddress', 'new@example.com');
    await pressButton('ButtonSave');
    expect(mockMutateAsync).toHaveBeenCalledWith({ newEmail: 'new@example.com' });
  });

  it('shows verification email sent message on success', async () => {
    mockMutateAsync.mockResolvedValue({});
    await render(<ChangeEmailScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderEmailAddress', 'new@example.com');
    await pressButton('ButtonSave');
    await waitFor(() => { expect(screen.queryByText('VerificationEmailSent')).toBeTruthy(); });
  });

  it('shows error banner when API fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Network error'));
    await render(<ChangeEmailScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderEmailAddress', 'new@example.com');
    await pressButton('ButtonSave');
    await waitFor(() => { expect(screen.queryByTestId('error-banner')).toBeTruthy(); });
  });

  it('calls captureError when API fails', async () => {
    const err = new Error('Network error');
    mockMutateAsync.mockRejectedValue(err);
    await render(<ChangeEmailScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderEmailAddress', 'new@example.com');
    await pressButton('ButtonSave');
    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(err, { screen: 'ChangeEmailScreen', action: 'changeEmail' });
    });
  });
});
