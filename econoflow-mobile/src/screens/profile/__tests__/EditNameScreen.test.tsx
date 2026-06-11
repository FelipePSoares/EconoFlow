import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { EditNameScreen } from '../EditNameScreen';

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

jest.mock('../../../hooks/useUpdateProfile', () => ({
  useUpdateProfile: jest.fn(() => ({
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
} as unknown as React.ComponentProps<typeof EditNameScreen>['navigation'];

const mockRoute = {} as unknown as React.ComponentProps<typeof EditNameScreen>['route'];

// ─── Helpers — capture element refs BEFORE entering act() ────────────────────

async function changeText(testID: string, value: string) {
  const el = screen.getByTestId(testID);
  await act(async () => { el.props.onChangeText(value); });
}

async function pressButton(testID: string) {
  fireEvent.press(screen.getByTestId(testID));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('EditNameScreen', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    // Default: never resolve — prevents accidental navigation
    mockMutateAsync.mockImplementation(() => new Promise(() => {}));
    mockGoBack.mockReset();
    mockCaptureError.mockReset();
  });

  it('pre-fills first name and last name from user store', async () => {
    await render(<EditNameScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByTestId('PlaceholderFirstName').props.value).toBe('Alice');
    expect(screen.getByTestId('PlaceholderLastName').props.value).toBe('Smith');
  });

  it('shows required field error when first name is cleared on submit', async () => {
    await render(<EditNameScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderFirstName', '');
    await pressButton('ButtonSave');
    await waitFor(() => { expect(screen.getAllByText('RequiredField').length).toBeGreaterThan(0); });
  });

  it('shows required field error when last name is cleared on submit', async () => {
    await render(<EditNameScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderLastName', '');
    await pressButton('ButtonSave');
    await waitFor(() => { expect(screen.getAllByText('RequiredField').length).toBeGreaterThan(0); });
  });

  it('calls patchUser with firstName and lastName patch ops on save', async () => {
    mockMutateAsync.mockResolvedValue({});
    await render(<EditNameScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderFirstName', 'Bob');
    await changeText('PlaceholderLastName', 'Jones');
    await pressButton('ButtonSave');
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ op: 'replace', path: '/firstName', value: 'Bob' }),
        expect.objectContaining({ op: 'replace', path: '/lastName', value: 'Jones' }),
      ]),
    );
  });

  it('navigates back on successful save', async () => {
    mockMutateAsync.mockResolvedValue({});
    await render(<EditNameScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderFirstName', 'Bob');
    await changeText('PlaceholderLastName', 'Jones');
    await pressButton('ButtonSave');
    await waitFor(() => { expect(mockGoBack).toHaveBeenCalledTimes(1); });
  });

  it('shows error banner when API fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Network error'));
    await render(<EditNameScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderFirstName', 'Bob');
    await changeText('PlaceholderLastName', 'Jones');
    await pressButton('ButtonSave');
    await waitFor(() => { expect(screen.queryByTestId('error-banner')).toBeTruthy(); });
  });

  it('calls captureError when API fails', async () => {
    const err = new Error('Network error');
    mockMutateAsync.mockRejectedValue(err);
    await render(<EditNameScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderFirstName', 'Bob');
    await changeText('PlaceholderLastName', 'Jones');
    await pressButton('ButtonSave');
    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(err, { screen: 'EditNameScreen', action: 'updateProfile' });
    });
  });
});
