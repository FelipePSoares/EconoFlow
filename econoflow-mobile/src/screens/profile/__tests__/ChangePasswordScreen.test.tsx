import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ChangePasswordScreen } from '../ChangePasswordScreen';

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
    AuroraField: ({ testID, placeholder, value, onChangeText, secureTextEntry }: {
      testID?: string;
      placeholder?: string;
      value?: string;
      onChangeText?: (t: string) => void;
      secureTextEntry?: boolean;
    }) =>
      React.createElement(TextInput, {
        testID: testID ?? placeholder,
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

// ─── Hook mocks ───────────────────────────────────────────────────────────────

const mockMutateAsync = jest.fn();

jest.mock('../../../hooks/useProfile', () => ({
  useChangePassword: jest.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockGoBack = jest.fn();
const mockNavigation = {
  goBack: mockGoBack,
} as unknown as React.ComponentProps<typeof ChangePasswordScreen>['navigation'];

const mockRoute = {} as unknown as React.ComponentProps<typeof ChangePasswordScreen>['route'];

// ─── Helpers — capture element refs BEFORE entering act() ────────────────────

async function changeText(testID: string, value: string) {
  const el = screen.getByTestId(testID);
  await act(async () => { el.props.onChangeText(value); });
}

async function pressButton(testID: string) {
  fireEvent.press(screen.getByTestId(testID));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ChangePasswordScreen', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    // Default: never resolve — prevents accidental navigation
    mockMutateAsync.mockImplementation(() => new Promise(() => {}));
    mockGoBack.mockReset();
  });

  it('renders current password, new password, and confirm password fields', async () => {
    await render(<ChangePasswordScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByTestId('PlaceholderCurrentPassword')).toBeTruthy();
    expect(screen.getByTestId('PlaceholderNewPassword')).toBeTruthy();
    expect(screen.getByTestId('PlaceholderConfirmNewPassword')).toBeTruthy();
  });

  it('shows required field error when current password is empty on submit', async () => {
    await render(<ChangePasswordScreen navigation={mockNavigation} route={mockRoute} />);
    await pressButton('ButtonSave');
    await waitFor(() => { expect(screen.getAllByText('RequiredField').length).toBeGreaterThan(0); });
  });

  it('shows error when new password and confirm password do not match', async () => {
    await render(<ChangePasswordScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderCurrentPassword', 'oldpass');
    await changeText('PlaceholderNewPassword', 'newpass1');
    await changeText('PlaceholderConfirmNewPassword', 'newpass2');
    await pressButton('ButtonSave');
    await waitFor(() => { expect(screen.getByText('PasswordsMustMatch')).toBeTruthy(); });
  });

  it('shows error when new password is same as current password', async () => {
    await render(<ChangePasswordScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderCurrentPassword', 'samepass');
    await changeText('PlaceholderNewPassword', 'samepass');
    await changeText('PlaceholderConfirmNewPassword', 'samepass');
    await pressButton('ButtonSave');
    await waitFor(() => { expect(screen.getByText('ErrorNewPasswordSameAsCurrent')).toBeTruthy(); });
  });

  it('calls useChangePassword.mutateAsync with oldPassword and newPassword on valid submit', async () => {
    mockMutateAsync.mockResolvedValue({});
    await render(<ChangePasswordScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderCurrentPassword', 'oldpass');
    await changeText('PlaceholderNewPassword', 'newpass');
    await changeText('PlaceholderConfirmNewPassword', 'newpass');
    await pressButton('ButtonSave');
    expect(mockMutateAsync).toHaveBeenCalledWith({ oldPassword: 'oldpass', newPassword: 'newpass' });
  });

  it('navigates back on successful save', async () => {
    mockMutateAsync.mockResolvedValue({});
    await render(<ChangePasswordScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderCurrentPassword', 'oldpass');
    await changeText('PlaceholderNewPassword', 'newpass');
    await changeText('PlaceholderConfirmNewPassword', 'newpass');
    await pressButton('ButtonSave');
    await waitFor(() => { expect(mockGoBack).toHaveBeenCalledTimes(1); });
  });

  it('shows error banner when API fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Network error'));
    await render(<ChangePasswordScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderCurrentPassword', 'oldpass');
    await changeText('PlaceholderNewPassword', 'newpass');
    await changeText('PlaceholderConfirmNewPassword', 'newpass');
    await pressButton('ButtonSave');
    await waitFor(() => { expect(screen.queryByTestId('error-banner')).toBeTruthy(); });
  });
});
