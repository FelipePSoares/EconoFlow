import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { TwoFactorScreen } from '../TwoFactorScreen';

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

// ─── Hook / store mocks ───────────────────────────────────────────────────────

const mockEnableMutateAsync = jest.fn();
const mockDisableMutateAsync = jest.fn();

jest.mock('../../../hooks/useProfile', () => ({
  useTwoFactorSetup: jest.fn(),
  useEnableTwoFactor: jest.fn(() => ({
    mutateAsync: mockEnableMutateAsync,
    isPending: false,
  })),
  useDisableTwoFactor: jest.fn(() => ({
    mutateAsync: mockDisableMutateAsync,
    isPending: false,
  })),
}));

jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn(),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockGoBack = jest.fn();
const mockNavigation = {
  goBack: mockGoBack,
} as unknown as React.ComponentProps<typeof TwoFactorScreen>['navigation'];

const mockRoute = {} as unknown as React.ComponentProps<typeof TwoFactorScreen>['route'];

// ─── Shared user fixture ──────────────────────────────────────────────────────

const baseUser = {
  id: 'u1', email: 'alice@example.com', firstName: 'Alice', lastName: 'Smith',
  fullName: 'Alice Smith', enabled: true, isFirstLogin: false, emailConfirmed: true,
  defaultProjectId: null, notificationChannels: [], languageCode: 'en', isBetaTester: false,
};

// ─── Helpers — capture element refs BEFORE entering act() ────────────────────

async function changeText(testID: string, value: string) {
  const el = screen.getByTestId(testID);
  await act(async () => { el.props.onChangeText(value); });
}

async function pressButton(testID: string) {
  fireEvent.press(screen.getByTestId(testID));
}

// ─── Setup (2FA disabled) ─────────────────────────────────────────────────────

describe('TwoFactorScreen – setup (2FA disabled)', () => {
  beforeEach(() => {
    mockEnableMutateAsync.mockReset();
    mockEnableMutateAsync.mockImplementation(() => new Promise(() => {}));
    mockGoBack.mockReset();

    jest.requireMock('../../../hooks/useProfile').useTwoFactorSetup.mockReturnValue({
      data: { isTwoFactorEnabled: false, sharedKey: 'abcd efgh', otpAuthUri: 'otpauth://...' },
      isLoading: false,
      isError: false,
    });
    jest.requireMock('../../../store/authStore').useAuthStore.mockReturnValue({
      user: { ...baseUser, twoFactorEnabled: false },
    });
  });

  it('shows the shared key', async () => {
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('abcd efgh')).toBeTruthy();
  });

  it('shows the setup title', async () => {
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('TwoFactorSetupInstructionsTitle')).toBeTruthy();
  });

  it('shows enable button', async () => {
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByTestId('ButtonEnableTwoFactor')).toBeTruthy();
  });

  it('shows required error when code is empty on enable', async () => {
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    await pressButton('ButtonEnableTwoFactor');
    await waitFor(() => { expect(screen.getAllByText('RequiredField').length).toBeGreaterThan(0); });
  });

  it('calls enableTwoFactor with the entered code', async () => {
    mockEnableMutateAsync.mockResolvedValue({ twoFactorEnabled: true, recoveryCodes: ['r1', 'r2'] });
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderAuthenticatorCode', '123456');
    await pressButton('ButtonEnableTwoFactor');
    expect(mockEnableMutateAsync).toHaveBeenCalledWith({ code: '123456' });
  });

  it('shows recovery codes after successful enable', async () => {
    mockEnableMutateAsync.mockResolvedValue({ twoFactorEnabled: true, recoveryCodes: ['rec-code-1', 'rec-code-2'] });
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderAuthenticatorCode', '123456');
    await pressButton('ButtonEnableTwoFactor');
    await waitFor(() => { expect(screen.queryByText('rec-code-1')).toBeTruthy(); });
  });

  it('shows error banner when enable API fails', async () => {
    mockEnableMutateAsync.mockRejectedValue(new Error('Invalid code'));
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderAuthenticatorCode', '999999');
    await pressButton('ButtonEnableTwoFactor');
    await waitFor(() => { expect(screen.queryByTestId('error-banner')).toBeTruthy(); });
  });
});

// ─── Disable (2FA enabled) ────────────────────────────────────────────────────

describe('TwoFactorScreen – disable (2FA enabled)', () => {
  beforeEach(() => {
    mockDisableMutateAsync.mockReset();
    mockDisableMutateAsync.mockImplementation(() => new Promise(() => {}));
    mockGoBack.mockReset();

    jest.requireMock('../../../hooks/useProfile').useTwoFactorSetup.mockReturnValue({
      data: { isTwoFactorEnabled: true, sharedKey: '', otpAuthUri: '' },
      isLoading: false,
      isError: false,
    });
    jest.requireMock('../../../store/authStore').useAuthStore.mockReturnValue({
      user: { ...baseUser, twoFactorEnabled: true },
    });
  });

  it('shows disable title when 2FA is enabled', async () => {
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('DisableTwoFactorTitle')).toBeTruthy();
  });

  it('shows disable button', async () => {
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByTestId('ButtonDisableTwoFactor')).toBeTruthy();
  });

  it('shows required error when password is empty on disable', async () => {
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    await pressButton('ButtonDisableTwoFactor');
    await waitFor(() => { expect(screen.getAllByText('RequiredField').length).toBeGreaterThan(0); });
  });

  it('calls disableTwoFactor with password and code', async () => {
    mockDisableMutateAsync.mockResolvedValue({ twoFactorEnabled: false });
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderCurrentPassword', 'mypassword');
    await changeText('PlaceholderAuthenticatorCode', '654321');
    await pressButton('ButtonDisableTwoFactor');
    expect(mockDisableMutateAsync).toHaveBeenCalledWith({ password: 'mypassword', twoFactorCode: '654321' });
  });

  it('navigates back after successful disable', async () => {
    mockDisableMutateAsync.mockResolvedValue({ twoFactorEnabled: false });
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderCurrentPassword', 'mypassword');
    await changeText('PlaceholderAuthenticatorCode', '654321');
    await pressButton('ButtonDisableTwoFactor');
    await waitFor(() => { expect(mockGoBack).toHaveBeenCalledTimes(1); });
  });

  it('shows error banner when disable API fails', async () => {
    mockDisableMutateAsync.mockRejectedValue(new Error('Invalid password'));
    await render(<TwoFactorScreen navigation={mockNavigation} route={mockRoute} />);
    await changeText('PlaceholderCurrentPassword', 'wrongpassword');
    await changeText('PlaceholderAuthenticatorCode', '111111');
    await pressButton('ButtonDisableTwoFactor');
    await waitFor(() => { expect(screen.queryByTestId('error-banner')).toBeTruthy(); });
  });
});
