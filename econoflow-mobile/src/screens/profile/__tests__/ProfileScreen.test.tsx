import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { ProfileScreen } from '../ProfileScreen';

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

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
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

// ─── Store / React Query mocks ────────────────────────────────────────────────

const mockClearAuth = jest.fn();
const mockClearProject = jest.fn();
const mockQueryClientClear = jest.fn();

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
    clearAuth: mockClearAuth,
  })),
}));

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(() => ({
    selectedProject: null,
    clearProject: mockClearProject,
  })),
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(() => ({ clear: mockQueryClientClear })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
} as unknown as React.ComponentProps<typeof ProfileScreen>['navigation'];

const mockRoute = {} as unknown as React.ComponentProps<typeof ProfileScreen>['route'];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProfileScreen – sign out', () => {
  beforeEach(() => {
    mockClearAuth.mockReset();
    mockClearProject.mockReset();
    mockQueryClientClear.mockReset();
    mockNavigate.mockReset();
  });

  it('calls clearAuth when the sign-out button is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByText('ButtonSignOut'));
    expect(mockClearAuth).toHaveBeenCalledTimes(1);
  });

  it('calls clearProject when the sign-out button is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByText('ButtonSignOut'));
    expect(mockClearProject).toHaveBeenCalledTimes(1);
  });

  it('clears the React Query cache when the sign-out button is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByText('ButtonSignOut'));
    expect(mockQueryClientClear).toHaveBeenCalledTimes(1);
  });
});

describe('ProfileScreen – row navigation', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it('navigates to EditName when the edit-name row is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-EditName'));
    expect(mockNavigate).toHaveBeenCalledWith('EditName');
  });

  it('navigates to ChangePassword when the change-password row is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-ChangePassword'));
    expect(mockNavigate).toHaveBeenCalledWith('ChangePassword');
  });

  it('navigates to ChangeEmail when the change-email row is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-ChangeEmail'));
    expect(mockNavigate).toHaveBeenCalledWith('ChangeEmail');
  });

  it('navigates to LanguagePicker when the language row is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-LanguagePicker'));
    expect(mockNavigate).toHaveBeenCalledWith('LanguagePicker');
  });

  it('navigates to TwoFactorSetup when the 2FA row is pressed', async () => {
    await render(<ProfileScreen navigation={mockNavigation} route={mockRoute} />);
    fireEvent.press(screen.getByTestId('row-TwoFactorSetup'));
    expect(mockNavigate).toHaveBeenCalledWith('TwoFactorSetup');
  });
});
