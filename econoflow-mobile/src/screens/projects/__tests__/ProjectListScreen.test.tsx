import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ProjectListScreen } from '../ProjectListScreen';

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

jest.mock('../../../components/common/LoadingIndicator', () => ({
  LoadingIndicator: jest.fn(() => null),
}));

jest.mock('../../../components/auth/AuroraPrimaryButton', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    AuroraPrimaryButton: ({
      label, onPress,
    }: { label: string; onPress: () => void }) =>
      React.createElement(
        TouchableOpacity,
        { onPress, testID: `btn-${label}` },
        React.createElement(Text, null, label),
      ),
  };
});

// ─── Store / hook mocks ───────────────────────────────────────────────────────

const mockSetSelectedProject = jest.fn();
const mockSetOpenCreateProjectOnStart = jest.fn();
const mockAuthState = {
  openCreateProjectOnStart: false,
  setOpenCreateProjectOnStart: mockSetOpenCreateProjectOnStart,
};

jest.mock('../../../hooks/useProjects', () => ({
  useProjects: jest.fn(() => ({ data: [], isLoading: false, refetch: jest.fn() })),
}));

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(() => ({
    selectedProject: null,
    setSelectedProject: mockSetSelectedProject,
  })),
}));

jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn((selector: (s: typeof mockAuthState) => unknown) => selector(mockAuthState)),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockGetParent = jest.fn(() => ({ navigate: jest.fn() }));

const mockNavigation = {
  navigate: mockNavigate,
  getParent: mockGetParent,
} as unknown as React.ComponentProps<typeof ProjectListScreen>['navigation'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_PROJECT = {
  id: 'up-1',
  userId: 'u1',
  userName: 'Test',
  userEmail: 'test@test.com',
  accepted: true,
  role: 'Admin' as const,
  project: { id: 'proj-1', name: 'My Project', preferredCurrency: 'EUR', isArchived: false },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getUseProjectsMock = (): jest.Mock =>
  (jest.requireMock('../../../hooks/useProjects') as any).useProjects;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ProjectListScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockSetSelectedProject.mockReset();
    mockSetOpenCreateProjectOnStart.mockReset();
    mockAuthState.openCreateProjectOnStart = false;
    mockGetParent.mockReturnValue({ navigate: jest.fn() });
  });

  it('shows the new project button when the list is empty', async () => {
    getUseProjectsMock().mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });

    await render(<ProjectListScreen navigation={mockNavigation} />);

    expect(screen.getByTestId('btn-ButtonNewProject')).toBeTruthy();
  });

  it('shows the new project button when projects exist', async () => {
    getUseProjectsMock().mockReturnValue({
      data: [MOCK_PROJECT],
      isLoading: false,
      refetch: jest.fn(),
    });

    await render(<ProjectListScreen navigation={mockNavigation} />);

    expect(screen.getByTestId('btn-ButtonNewProject')).toBeTruthy();
  });

  it('navigates to CreateProject when the new project button is pressed', async () => {
    getUseProjectsMock().mockReturnValue({
      data: [MOCK_PROJECT],
      isLoading: false,
      refetch: jest.fn(),
    });

    await render(<ProjectListScreen navigation={mockNavigation} />);

    fireEvent.press(screen.getByTestId('btn-ButtonNewProject'));

    expect(mockNavigate).toHaveBeenCalledWith('CreateProject', {});
  });

  it('navigates to CreateProject and clears flag on mount when openCreateProjectOnStart is true', async () => {
    mockAuthState.openCreateProjectOnStart = true;
    getUseProjectsMock().mockReturnValue({ data: [], isLoading: false, refetch: jest.fn() });

    await render(<ProjectListScreen navigation={mockNavigation} />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('CreateProject', { fromOnboarding: true });
      expect(mockSetOpenCreateProjectOnStart).toHaveBeenCalledWith(false);
    });
  });
});
