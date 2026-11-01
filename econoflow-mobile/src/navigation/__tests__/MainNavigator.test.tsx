import React from 'react';
import { render, screen, waitFor } from '@testing-library/react-native';
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

jest.mock('../ProfileStackNavigator', () => ({
  ProfileStackNavigator: () => null,
}));

jest.mock('../../screens/profile/ProfileScreen', () => ({
  ProfileScreen: () => null,
}));

jest.mock('../../screens/quick-add/QuickAddModal', () => ({
  QuickAddModal: () => null,
}));

// ─── Notification permission prompt (#1053) ───────────────────────────────────

// Only the push flow is mocked: the real `useNotificationPermissionPrompt` must then
// fire it once `Main` mounts, which is exactly the behaviour under test.
const mockRequestNotificationPermissionAndRegister = jest.fn();

jest.mock('../../hooks/usePushNotifications', () => ({
  requestNotificationPermissionAndRegister: (...args: unknown[]) =>
    mockRequestNotificationPermissionAndRegister(...args),
  openNotificationSettings: jest.fn(),
}));

jest.mock('../../components/auth/AuroraPrimaryButton', () => {
  const React = require('react');
  return { AuroraPrimaryButton: () => React.createElement(React.Fragment, null) };
});

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

// The prompt only acts once SecureStore rehydration settles; the store mock below starts
// hydrated so the hook can run in these tests.

jest.mock('../../store/notificationStore', () => {
  const { create } = jest.requireActual('zustand');
  const useNotificationStore = create((set: (partial: Record<string, unknown>) => void) => ({
    // Plain values, not a getter: a getter is only read when the selector runs on a
    // store notification, so the component would never see the post-retest value.
    hasHydrated: true,
    hasPromptedForPermission: false,
    pushPermissionStatus: 'undetermined',
    canAskForPermission: true,
    // A relaunch always arrives with the session bound to the account it belongs to;
    // the prompt waits for that before deciding anything (#1053).
    sessionBound: true,
    signedInUserKey: 'user-a',
    currentUserKey: 'user-a',
    notificationsEnabled: false,
    expoPushToken: null,
    setHasPromptedForPermission: (prompted: boolean) => set({ hasPromptedForPermission: prompted }),
    markAsked: () => set({ hasPromptedForPermission: true }),
  }));
  return { useNotificationStore };
});

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

// The integration suite (e2e/) finds the tabs by these ids — `cells.js` taps `tab-profile` to
// sign out, and the biometric spec asserts the app opened on `tab-overview`. The label is a
// translated string and the tab bar sets no ids of its own, so these are the contract.
describe('MainNavigator – tab ids for the integration tests', () => {
  it.each([
    ['tab-projects'],
    ['tab-overview'],
    ['tab-plans'],
    ['tab-profile'],
  ])('exposes %s on its tab button', async (testID) => {
    await render(
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>,
    );

    expect(screen.getByTestId(testID)).toBeTruthy();
  });

  it('keeps one id per tab, so a matcher cannot hit two', async () => {
    await render(
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>,
    );

    for (const testID of ['tab-projects', 'tab-overview', 'tab-plans', 'tab-profile']) {
      expect(screen.getAllByTestId(testID)).toHaveLength(1);
    }
  });
});

// #1116: right after a successful login the customer saw a blank screen — the session was
// there, nothing was drawn — and needed an app restart to get the PIN. The signed-in tree
// now has a painter of its own under the tabs, so there is always something to draw.
describe('MainNavigator – always paints (#1116)', () => {
  it('renders a background under the tabs, independent of what they show', async () => {
    await render(
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>,
    );

    expect(screen.getByTestId('overview-screen')).toBeTruthy();
  });
});

describe('MainNavigator – notification permission prompt (#1053)', () => {
  beforeEach(() => {
    mockRequestNotificationPermissionAndRegister.mockReset();
    mockRequestNotificationPermissionAndRegister.mockResolvedValue({ ok: true });
  });

  it('runs the shared permission flow after the main screen mounts', async () => {
    // `Main` is the one screen every authenticated path reaches (password login,
    // registration auto-login, 2FA), after the biometric gate — the only place where
    // the OS dialog cannot race another system prompt.
    await render(
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>,
    );

    await waitFor(() => {
      expect(mockRequestNotificationPermissionAndRegister).toHaveBeenCalledTimes(1);
    });
  });

  it('does not ask again while the user stays on the main screen', async () => {
    const { rerender } = await render(
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>,
    );

    await waitFor(() => expect(mockRequestNotificationPermissionAndRegister).toHaveBeenCalledTimes(1));

    rerender(
      <NavigationContainer>
        <MainNavigator />
      </NavigationContainer>,
    );

    expect(mockRequestNotificationPermissionAndRegister).toHaveBeenCalledTimes(1);
  });
});
