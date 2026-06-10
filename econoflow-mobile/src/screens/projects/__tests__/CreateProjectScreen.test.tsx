import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { CreateProjectScreen } from '../CreateProjectScreen';

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
    customColors: { success: '#2ecc71', warning: '#f39c12' },
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
      label, onPress, loading,
    }: { label: string; onPress: () => void; loading?: boolean }) =>
      loading
        ? React.createElement(Text, { testID: 'loading-indicator' }, 'Loading')
        : React.createElement(
            TouchableOpacity,
            { onPress, testID: label },
            React.createElement(Text, null, label),
          ),
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

// ─── Store / hook mocks ───────────────────────────────────────────────────────

const mockMutateAsync = jest.fn();
const mockSetSelectedProject = jest.fn();

jest.mock('../../../hooks/useProjects', () => ({
  useCreateProject: jest.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

jest.mock('../../../api/projects.api', () => ({
  putTaxYearSettings: jest.fn(),
}));

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(() => ({
    setSelectedProject: mockSetSelectedProject,
  })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  dispatch: jest.fn(),
} as unknown as React.ComponentProps<typeof CreateProjectScreen>['navigation'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_USER_PROJECT = {
  id: 'up-1',
  userId: 'u1',
  userName: 'Test',
  userEmail: 'test@test.com',
  accepted: true,
  role: 'Admin' as const,
  project: { id: 'proj-1', name: 'My Project', preferredCurrency: 'EUR', isArchived: false },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getPutTaxYearMock = (): jest.Mock =>
  (jest.requireMock('../../../api/projects.api') as any).putTaxYearSettings;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CreateProjectScreen', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockNavigate.mockReset();
    mockGoBack.mockReset();
    mockSetSelectedProject.mockReset();
    getPutTaxYearMock().mockReset();
  });

  it('shows required field error when name is empty on submit', async () => {
    await render(<CreateProjectScreen navigation={mockNavigation} />);

    await fireEvent.press(screen.getByTestId('ButtonCreate'));

    expect(await screen.findByText('RequiredField')).toBeTruthy();
  });

  it('shows conditional tax year fields when Custom Start Month is selected', async () => {
    await render(<CreateProjectScreen navigation={mockNavigation} />);

    await fireEvent.press(screen.getByText('TaxYearTypeCustom'));

    expect(screen.getByTestId('FieldTaxYearStartMonth')).toBeTruthy();
    expect(screen.getByTestId('FieldTaxYearStartDay')).toBeTruthy();
  });

  it('hides conditional fields when Calendar Year is selected', async () => {
    await render(<CreateProjectScreen navigation={mockNavigation} />);

    await fireEvent.press(screen.getByText('TaxYearTypeCustom'));
    await fireEvent.press(screen.getByText('TaxYearTypeCalendar'));

    expect(screen.queryByTestId('FieldTaxYearStartMonth')).toBeNull();
    expect(screen.queryByTestId('FieldTaxYearStartDay')).toBeNull();
  });

  it('calls createProject, putTaxYearSettings, sets project, and navigates to SmartSetup on success', async () => {
    mockMutateAsync.mockResolvedValue(MOCK_USER_PROJECT);
    getPutTaxYearMock().mockResolvedValue({ data: undefined });

    await render(<CreateProjectScreen navigation={mockNavigation} />);

    await fireEvent.changeText(screen.getByTestId('PlaceholderProjectName'), 'My Budget');
    await fireEvent.changeText(screen.getByTestId('FieldCurrency'), 'EUR');
    await fireEvent.press(screen.getByTestId('ButtonCreate'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'My Budget', preferredCurrency: 'EUR' }),
      );
      expect(getPutTaxYearMock()).toHaveBeenCalledWith(
        'proj-1',
        expect.objectContaining({ taxYearType: 'CalendarYear' }),
      );
      expect(mockSetSelectedProject).toHaveBeenCalledWith(MOCK_USER_PROJECT);
      expect(mockNavigate).toHaveBeenCalledWith('SmartSetup', { projectId: 'proj-1' });
    });
  });

  it('shows ErrorBanner when createProject API call fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Network error'));

    await render(<CreateProjectScreen navigation={mockNavigation} />);

    await fireEvent.changeText(screen.getByTestId('PlaceholderProjectName'), 'My Budget');
    await fireEvent.changeText(screen.getByTestId('FieldCurrency'), 'EUR');
    await fireEvent.press(screen.getByTestId('ButtonCreate'));

    expect(await screen.findByTestId('error-banner', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('calls goBack when cancel is pressed', async () => {
    await render(<CreateProjectScreen navigation={mockNavigation} />);
    await fireEvent.press(screen.getByText('ButtonCancel'));
    expect(mockGoBack).toHaveBeenCalledTimes(1);
  });
});
