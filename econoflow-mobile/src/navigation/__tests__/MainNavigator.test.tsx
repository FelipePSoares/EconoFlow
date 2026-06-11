import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { MainNavigator } from '../MainNavigator';

// ─── Icon / gradient mocks ────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('expo-linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('react-native-safe-area-context', () => {
  const React = require('react');
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const SafeAreaInsetsContext = React.createContext(insets);
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaInsetsContext,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => ({ width: 0, height: 0, x: 0, y: 0 }),
  };
});

// ─── Tab screen mocks ─────────────────────────────────────────────────────────

jest.mock('../ProjectStackNavigator', () => ({
  ProjectStackNavigator: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: 'projects-stack' }, 'Projects');
  },
}));

jest.mock('../OverviewStackNavigator', () => ({
  OverviewStackNavigator: () => {
    const React = require('react');
    const { Text } = require('react-native');
    return React.createElement(Text, { testID: 'overview-stack' }, 'Overview');
  },
}));

jest.mock('../PlansStackNavigator', () => ({
  PlansStackNavigator: () => null,
}));

jest.mock('../../screens/profile/ProfileScreen', () => ({
  ProfileScreen: () => null,
}));

jest.mock('../../screens/quick-add/QuickAddModal', () => ({
  QuickAddModal: () => null,
}));

// ─── Store mocks ──────────────────────────────────────────────────────────────

jest.mock('../../store/uiStore', () => ({
  useUIStore: jest.fn((selector: (s: { hideTabBar: boolean }) => unknown) =>
    selector({ hideTabBar: false }),
  ),
}));

jest.mock('../../store/quickAddStore', () => ({
  useQuickAddStore: jest.fn(
    (selector: (s: { categoryId: string | null; defaultType: string | null; viewedMonth: string | null }) => unknown) =>
      selector({ categoryId: null, defaultType: null, viewedMonth: null }),
  ),
}));

jest.mock('../../utils/date', () => ({
  currentMonth: jest.fn(() => '2026-06'),
}));

let mockOpenCreateProjectOnStart = false;

jest.mock('../../store/authStore', () => ({
  useAuthStore: jest.fn((selector: (s: { openCreateProjectOnStart: boolean }) => unknown) =>
    selector({ openCreateProjectOnStart: mockOpenCreateProjectOnStart }),
  ),
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MainNavigator – initial tab based on openCreateProjectOnStart', () => {
  afterEach(() => {
    mockOpenCreateProjectOnStart = false;
  });

  it('starts on Overview tab when openCreateProjectOnStart is false', async () => {
    mockOpenCreateProjectOnStart = false;
    await render(
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>,
    );
    // Verify via tab bar aria state (robust: survives lazy=false config changes)
    const overviewTab = screen.getByLabelText(/TabOverview/);
    expect(overviewTab.props.accessibilityState?.selected).toBe(true);
    const projectsTab = screen.getByLabelText(/TabProjects/);
    expect(projectsTab.props.accessibilityState?.selected).toBe(false);
  });

  it('starts on Projects tab when openCreateProjectOnStart is true', async () => {
    mockOpenCreateProjectOnStart = true;
    await render(
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>,
    );
    // Verify via tab bar aria state (robust: survives lazy=false config changes)
    const projectsTab = screen.getByLabelText(/TabProjects/);
    expect(projectsTab.props.accessibilityState?.selected).toBe(true);
    const overviewTab = screen.getByLabelText(/TabOverview/);
    expect(overviewTab.props.accessibilityState?.selected).toBe(false);
  });
});
