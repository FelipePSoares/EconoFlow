import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { LanguagePickerScreen } from '../LanguagePickerScreen';

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

// ─── i18n mock — use jest.fn() inline to avoid hoisting TDZ issues ───────────

jest.mock('../../../i18n', () => ({
  __esModule: true,
  default: { language: 'en-US', changeLanguage: jest.fn() },
}));

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
      languageCode: 'en-US',
      isBetaTester: false,
    },
  })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigation = {} as unknown as React.ComponentProps<typeof LanguagePickerScreen>['navigation'];
const mockRoute = {} as unknown as React.ComponentProps<typeof LanguagePickerScreen>['route'];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('LanguagePickerScreen', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    jest.requireMock('../../../i18n').default.changeLanguage.mockReset();
    mockCaptureError.mockReset();
  });

  it('renders language options for en-US and pt-BR', async () => {
    await render(<LanguagePickerScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByTestId('lang-en-US')).toBeTruthy();
    expect(screen.getByTestId('lang-pt-BR')).toBeTruthy();
  });

  it('shows a checkmark next to the currently selected language', async () => {
    await render(<LanguagePickerScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByTestId('lang-en-US-selected')).toBeTruthy();
  });

  it('calls patchUser with languageCode when a language is selected', async () => {
    mockMutateAsync.mockResolvedValue({});
    await render(<LanguagePickerScreen navigation={mockNavigation} route={mockRoute} />);
    const btn = screen.getByTestId('lang-pt-BR');
    fireEvent.press(btn);
    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ op: 'replace', path: '/languageCode', value: 'pt-BR' }),
      ]),
    );
  });

  it('calls i18n.changeLanguage only after successful API call', async () => {
    mockMutateAsync.mockResolvedValue({});
    await render(<LanguagePickerScreen navigation={mockNavigation} route={mockRoute} />);
    const btn = screen.getByTestId('lang-pt-BR');
    fireEvent.press(btn);
    await waitFor(() => {
      expect(jest.requireMock('../../../i18n').default.changeLanguage).toHaveBeenCalledWith('pt-BR');
    });
  });

  it('shows error banner when API fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Network error'));
    await render(<LanguagePickerScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('lang-pt-BR'));
    await waitFor(() => { expect(screen.queryByTestId('error-banner')).toBeTruthy(); });
  });

  it('does not call i18n.changeLanguage when API fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Network error'));
    await render(<LanguagePickerScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('lang-pt-BR'));
    await waitFor(() => { expect(screen.queryByTestId('error-banner')).toBeTruthy(); });
    expect(jest.requireMock('../../../i18n').default.changeLanguage).not.toHaveBeenCalled();
  });

  it('calls captureError when API fails', async () => {
    const err = new Error('Network error');
    mockMutateAsync.mockRejectedValue(err);
    await render(<LanguagePickerScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('lang-pt-BR'));
    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(err, { screen: 'LanguagePickerScreen', action: 'updateLanguage' });
    });
  });
});
