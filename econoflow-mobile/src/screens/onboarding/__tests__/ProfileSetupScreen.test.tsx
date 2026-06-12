import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ProfileSetupScreen } from '../ProfileSetupScreen';

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

jest.mock('../../../theme/useAuroraSkin', () => ({
  useAuroraSkin: () => ({ dark: false, ink: '#000', ink2: '#666', hair: '#ccc' }),
}));

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { primary: '#0f76a8', error: '#e74c3c', surface: '#fff' },
    customColors: {},
  }),
}));

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    HelperText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
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

jest.mock('../../../components/common/GlassCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassCard: ({ children }: { children: React.ReactNode }) =>
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

jest.mock('../../../components/auth/AuthHero', () => ({
  AuthHero: jest.fn(() => null),
}));

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

jest.mock('../../../i18n', () => ({
  __esModule: true,
  default: { language: 'en', changeLanguage: jest.fn() },
}));

// ─── Sentry mock ─────────────────────────────────────────────────────────────

const mockCaptureError = jest.fn();
jest.mock('../../../monitoring/sentry', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

// ─── Push notification mock ────────────────────────────────────────────────────

const mockRegisterPushNotifications = jest.fn();

jest.mock('../../../hooks/usePushNotifications', () => ({
  usePushNotifications: jest.fn(() => ({
    registerPushNotifications: mockRegisterPushNotifications,
  })),
}));

// ─── Hook / store mocks ───────────────────────────────────────────────────────

const mockMutateAsync = jest.fn();
const mockSetOpenCreateProjectOnStart = jest.fn();

jest.mock('../../../hooks/useUpdateProfile', () => ({
  useUpdateProfile: jest.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn(
    (selector: (s: { openCreateProjectOnStart: boolean; setOpenCreateProjectOnStart: jest.Mock }) => unknown) =>
      selector({ openCreateProjectOnStart: false, setOpenCreateProjectOnStart: mockSetOpenCreateProjectOnStart }),
  ),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  dispatch: jest.fn(),
} as unknown as React.ComponentProps<typeof ProfileSetupScreen>['navigation'];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProfileSetupScreen', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockNavigate.mockReset();
    mockSetOpenCreateProjectOnStart.mockReset();
    mockCaptureError.mockReset();
    mockRegisterPushNotifications.mockReset();
  });

  it('renders first name, last name, and language fields', async () => {
    await render(<ProfileSetupScreen navigation={mockNavigation} />);
    expect(screen.getByTestId('PlaceholderFirstName')).toBeTruthy();
    expect(screen.getByTestId('PlaceholderLastName')).toBeTruthy();
  });

  it('shows required field error when first name is empty on submit', async () => {
    await render(<ProfileSetupScreen navigation={mockNavigation} />);

    await fireEvent.press(screen.getByTestId('ButtonSaveAndContinue'));

    expect((await screen.findAllByText('RequiredField')).length).toBeGreaterThan(0);
  });

  it('shows required field error when last name is empty on submit', async () => {
    await render(<ProfileSetupScreen navigation={mockNavigation} />);

    await fireEvent.changeText(screen.getByTestId('PlaceholderFirstName'), 'John');
    await fireEvent.press(screen.getByTestId('ButtonSaveAndContinue'));

    expect(await screen.findByText('RequiredField')).toBeTruthy();
  });

  it('calls patchUser with correct JSON patch on submit', async () => {
    mockMutateAsync.mockResolvedValue({});

    await render(<ProfileSetupScreen navigation={mockNavigation} />);

    await fireEvent.changeText(screen.getByTestId('PlaceholderFirstName'), 'John');
    await fireEvent.changeText(screen.getByTestId('PlaceholderLastName'), 'Doe');
    await fireEvent.press(screen.getByTestId('ButtonSaveAndContinue'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ op: 'replace', path: '/firstName', value: 'John' }),
          expect.objectContaining({ op: 'replace', path: '/lastName', value: 'Doe' }),
        ]),
      );
    });
  });

  it('sets openCreateProjectOnStart on successful submit', async () => {
    mockMutateAsync.mockResolvedValue({});

    await render(<ProfileSetupScreen navigation={mockNavigation} />);

    await act(async () => {
      await fireEvent.changeText(screen.getByTestId('PlaceholderFirstName'), 'John');
      await fireEvent.changeText(screen.getByTestId('PlaceholderLastName'), 'Doe');
      await fireEvent.press(screen.getByTestId('ButtonSaveAndContinue'));
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(mockSetOpenCreateProjectOnStart).toHaveBeenCalledWith(true);
    });
  });

  it('shows error banner when patchUser API fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Network error'));

    await render(<ProfileSetupScreen navigation={mockNavigation} />);

    await fireEvent.changeText(screen.getByTestId('PlaceholderFirstName'), 'John');
    await fireEvent.changeText(screen.getByTestId('PlaceholderLastName'), 'Doe');
    await fireEvent.press(screen.getByTestId('ButtonSaveAndContinue'));

    expect(await screen.findByTestId('error-banner', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('resets openCreateProjectOnStart when patchUser API fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Network error'));

    await render(<ProfileSetupScreen navigation={mockNavigation} />);

    await fireEvent.changeText(screen.getByTestId('PlaceholderFirstName'), 'John');
    await fireEvent.changeText(screen.getByTestId('PlaceholderLastName'), 'Doe');
    await fireEvent.press(screen.getByTestId('ButtonSaveAndContinue'));

    await waitFor(() => {
      expect(mockSetOpenCreateProjectOnStart).toHaveBeenCalledWith(false);
    });
  });

  it('calls captureError when patchUser API fails', async () => {
    const err = new Error('Network error');
    mockMutateAsync.mockRejectedValue(err);

    await render(<ProfileSetupScreen navigation={mockNavigation} />);

    await fireEvent.changeText(screen.getByTestId('PlaceholderFirstName'), 'John');
    await fireEvent.changeText(screen.getByTestId('PlaceholderLastName'), 'Doe');
    await fireEvent.press(screen.getByTestId('ButtonSaveAndContinue'));

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        err,
        { screen: 'ProfileSetupScreen', action: 'setupProfile' },
      );
    });
  });

  it('does not render a skip or back button', async () => {
    await render(<ProfileSetupScreen navigation={mockNavigation} />);
    expect(screen.queryByText('SmartSetupSkip')).toBeNull();
    expect(screen.queryByText('ButtonCancel')).toBeNull();
    expect(screen.queryByText('SmartSetupBack')).toBeNull();
  });

  it('calls registerPushNotifications on successful submit', async () => {
    mockMutateAsync.mockResolvedValue({});

    await render(<ProfileSetupScreen navigation={mockNavigation} />);

    await act(async () => {
      await fireEvent.changeText(screen.getByTestId('PlaceholderFirstName'), 'John');
      await fireEvent.changeText(screen.getByTestId('PlaceholderLastName'), 'Doe');
      await fireEvent.press(screen.getByTestId('ButtonSaveAndContinue'));
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(mockRegisterPushNotifications).toHaveBeenCalled();
    });
  });

  it('does not show error banner when registerPushNotifications fails', async () => {
    mockMutateAsync.mockResolvedValue({});
    mockRegisterPushNotifications.mockRejectedValue(new Error('Push error'));

    await render(<ProfileSetupScreen navigation={mockNavigation} />);

    await act(async () => {
      await fireEvent.changeText(screen.getByTestId('PlaceholderFirstName'), 'John');
      await fireEvent.changeText(screen.getByTestId('PlaceholderLastName'), 'Doe');
      await fireEvent.press(screen.getByTestId('ButtonSaveAndContinue'));
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    await waitFor(() => {
      expect(screen.queryByTestId('error-banner')).toBeNull();
    });
  });
});
