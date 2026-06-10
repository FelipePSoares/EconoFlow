import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { CommonActions } from '@react-navigation/native';
import { SmartSetupScreen } from '../SmartSetupScreen';
import type { DefaultCategory } from '../../../api/types';
import { useUIStore } from '../../../store/uiStore';

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

jest.mock('../../../components/auth/AuroraField', () => {
  const React = require('react');
  const { TextInput, Text, View } = require('react-native');
  return {
    AuroraField: ({ testID, placeholder, value, onChangeText, textPrefix }: {
      testID?: string;
      placeholder?: string;
      value?: string;
      onChangeText?: (t: string) => void;
      textPrefix?: string;
    }) =>
      React.createElement(View, null,
        textPrefix
          ? React.createElement(Text, { testID: `${testID ?? placeholder}-prefix` }, textPrefix)
          : null,
        React.createElement(TextInput, {
          testID: testID ?? placeholder,
          value,
          onChangeText,
        }),
      ),
  };
});

jest.mock('../../../components/auth/AuroraPrimaryButton', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    AuroraPrimaryButton: ({
      label, onPress, loading, disabled,
    }: { label: string; onPress: () => void; loading?: boolean; disabled?: boolean }) =>
      loading
        ? React.createElement(Text, { testID: 'loading-indicator' }, 'Loading')
        : React.createElement(
            TouchableOpacity,
            { onPress, testID: label, accessibilityState: { disabled: !!disabled } },
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

jest.mock('@react-navigation/native', () => ({
  CommonActions: {
    reset: jest.fn((payload) => ({ type: 'RESET', payload })),
  },
}));

jest.mock('dayjs', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dayjs = (): any => ({ format: () => '2026-01-01' });
  return dayjs;
});

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(() => ({ currency: 'EUR' })),
}));

// ─── Hook mocks ───────────────────────────────────────────────────────────────

const MOCK_CATEGORIES: DefaultCategory[] = [
  { id: 'cat-1', name: 'Housing', percentage: 60 },
  { id: 'cat-2', name: 'Food', percentage: 40 },
];

const mockMutateAsync = jest.fn();

jest.mock('../../../hooks/useSmartSetup', () => ({
  useDefaultCategories: jest.fn(() => ({
    data: MOCK_CATEGORIES,
    isLoading: false,
  })),
  usePostSmartSetup: jest.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockDispatch = jest.fn();
const mockParentNavigate = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  dispatch: mockDispatch,
  getParent: jest.fn(() => ({ navigate: mockParentNavigate })),
} as unknown as React.ComponentProps<typeof SmartSetupScreen>['navigation'];

const mockRoute = {
  params: { projectId: 'proj-1' },
} as unknown as React.ComponentProps<typeof SmartSetupScreen>['route'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const goToStep2 = async () => {
  await fireEvent.changeText(screen.getByTestId('FieldAnnualIncome'), '60000');
  await fireEvent.press(screen.getByTestId('SmartSetupNext'));
  await screen.findByText('SmartSetupStep2Title');
};

const goToStep3 = async () => {
  await goToStep2();
  await fireEvent.press(screen.getByTestId('SmartSetupNext'));
  await screen.findByText('SmartSetupStep3Title');
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('SmartSetupScreen', () => {
  beforeEach(() => {
    mockMutateAsync.mockReset();
    mockNavigate.mockReset();
    mockDispatch.mockReset();
    mockParentNavigate.mockReset();
    (CommonActions.reset as jest.Mock).mockClear();
    useUIStore.setState({ hideTabBar: false });
  });

  it('renders step 1 with annual income field by default', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('SmartSetupStep1Title')).toBeTruthy();
    expect(screen.getByTestId('FieldAnnualIncome')).toBeTruthy();
  });

  it('shows Skip button on step 1', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);
    expect(screen.getByText('SmartSetupSkip')).toBeTruthy();
  });

  it('sets hideTabBar true on mount and false on unmount', async () => {
    const { unmount } = await render(
      <SmartSetupScreen navigation={mockNavigation} route={mockRoute} />,
    );

    expect(useUIStore.getState().hideTabBar).toBe(true);

    await act(async () => { unmount(); });

    expect(useUIStore.getState().hideTabBar).toBe(false);
  });

  it('Skip on step 1 resets the project stack and navigates to Overview', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await fireEvent.press(screen.getByText('SmartSetupSkip'));

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RESET' }),
    );
    expect(mockParentNavigate).toHaveBeenCalledWith('Overview');
  });

  it('Next on step 1 is disabled when income field is empty', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);
    const nextBtn = screen.getByTestId('SmartSetupNext');
    expect(nextBtn.props.accessibilityState?.disabled).toBe(true);
  });

  it('Next on step 1 is enabled after entering a positive income', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await fireEvent.changeText(screen.getByTestId('FieldAnnualIncome'), '60000');

    expect(screen.getByTestId('SmartSetupNext').props.accessibilityState?.disabled).toBe(false);
  });

  it('navigates to step 2 after entering income and pressing Next', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await goToStep2();

    expect(screen.getByText('SmartSetupStep2Title')).toBeTruthy();
  });

  it('renders category list in step 2', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await goToStep2();

    expect(screen.getByTestId('cat-1-name').props.value).toBe('Housing');
    expect(screen.getByTestId('cat-2-name').props.value).toBe('Food');
  });

  it('Next on step 2 is disabled when total exceeds 100', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await goToStep2();

    // 80 + 40 = 120 — over 100
    await fireEvent.changeText(screen.getByTestId('cat-1-pct'), '80');

    expect(screen.getByTestId('SmartSetupNext').props.accessibilityState?.disabled).toBe(true);
  });

  it('Next on step 2 is enabled when percentages sum to 100', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await goToStep2();

    await waitFor(() => {
      expect(screen.getByTestId('SmartSetupNext').props.accessibilityState?.disabled).toBe(false);
    });
  });

  it('Next on step 2 is enabled when total is less than 100', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await goToStep2();

    // 30 + 40 = 70 — under 100 should now be allowed
    await fireEvent.changeText(screen.getByTestId('cat-1-pct'), '30');

    await waitFor(() => {
      expect(screen.getByTestId('SmartSetupNext').props.accessibilityState?.disabled).toBe(false);
    });
  });

  it('navigates to step 3 from step 2', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await goToStep3();

    expect(screen.getByText('SmartSetupStep3Title')).toBeTruthy();
  });

  it('pre-fills emergency reserve in step 3 based on income', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await fireEvent.changeText(screen.getByTestId('FieldAnnualIncome'), '12000');
    await fireEvent.press(screen.getByTestId('SmartSetupNext'));
    await screen.findByText('SmartSetupStep2Title');
    await fireEvent.press(screen.getByTestId('SmartSetupNext'));
    await screen.findByText('SmartSetupStep3Title');

    // 6 × (12000 / 12) = 6000
    const reserveField = screen.getByTestId('SmartSetupEmergencyReserveLabel');
    expect(reserveField.props.value).toBe('6000.00');
  });

  it('Finish calls postSmartSetup and navigates to Overview on success', async () => {
    mockMutateAsync.mockResolvedValue(undefined);

    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await goToStep3();
    await fireEvent.press(screen.getByTestId('SmartSetupFinish'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        projectId: 'proj-1',
        data: expect.objectContaining({
          annualIncome: 60000,
          date: '2026-01-01',
          defaultCategories: expect.arrayContaining([
            expect.objectContaining({ id: 'cat-1', percentage: 60 }),
            expect.objectContaining({ id: 'cat-2', percentage: 40 }),
          ]),
        }),
      });
      expect(mockParentNavigate).toHaveBeenCalledWith('Overview');
    });
  });

  it('shows ErrorBanner when Finish API call fails', async () => {
    mockMutateAsync.mockRejectedValue(new Error('Server error'));

    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await goToStep3();
    await fireEvent.press(screen.getByTestId('SmartSetupFinish'));

    expect(await screen.findByTestId('error-banner', {}, { timeout: 3000 })).toBeTruthy();
  });

  it('Skip on step 2 navigates to Overview', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await goToStep2();
    await fireEvent.press(screen.getAllByText('SmartSetupSkip')[0]);

    expect(mockParentNavigate).toHaveBeenCalledWith('Overview');
  });

  it('Back on step 2 returns to step 1', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await goToStep2();

    await fireEvent.press(screen.getByText('SmartSetupBack'));

    expect(await screen.findByText('SmartSetupStep1Title')).toBeTruthy();
  });

  it('Back on step 3 returns to step 2', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    await goToStep3();

    await fireEvent.press(screen.getByText('SmartSetupBack'));

    expect(await screen.findByText('SmartSetupStep2Title')).toBeTruthy();
  });

  it('progress bar step 0 is active on initial render', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);

    const pill = screen.getByTestId('progress-step-0');
    const flatStyle = Array.isArray(pill.props.style)
      ? Object.assign({}, ...pill.props.style)
      : pill.props.style;
    expect(flatStyle.opacity).toBe(1);
  });

  it('shows currency symbol from project store as prefix for income field', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);
    const prefix = screen.queryByTestId('FieldAnnualIncome-prefix');
    expect(prefix?.props.children).toBe('€');
  });

  it('renders editable name input for each category in step 2', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);
    await goToStep2();

    expect(screen.getByTestId('cat-1-name')).toBeTruthy();
    expect(screen.getByTestId('cat-2-name')).toBeTruthy();
  });

  it('category name can be changed in step 2', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);
    await goToStep2();

    await fireEvent.changeText(screen.getByTestId('cat-1-name'), 'Rent');

    expect(screen.getByTestId('cat-1-name').props.value).toBe('Rent');
  });

  it('category can be deleted in step 2', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);
    await goToStep2();

    await fireEvent.press(screen.getByTestId('cat-1-delete'));

    expect(screen.queryByTestId('cat-1-name')).toBeNull();
    expect(screen.getByTestId('cat-2-name')).toBeTruthy();
  });

  it('new category can be added in step 2', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);
    await goToStep2();

    const beforeCount = screen.getAllByTestId(/-name$/).length;
    await fireEvent.press(screen.getByTestId('add-category-btn'));

    expect(screen.getAllByTestId(/-name$/).length).toBe(beforeCount + 1);
  });

  it('renders percentage slider alongside numeric input in step 2', async () => {
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);
    await goToStep2();

    expect(screen.getByTestId('cat-1-pct-slider')).toBeTruthy();
    expect(screen.getByTestId('cat-1-pct')).toBeTruthy();
  });

  it('updated category name is submitted in Finish payload', async () => {
    mockMutateAsync.mockResolvedValue(undefined);
    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);
    await goToStep2();

    await fireEvent.changeText(screen.getByTestId('cat-1-name'), 'Rent');
    await fireEvent.press(screen.getByTestId('SmartSetupNext'));
    await screen.findByText('SmartSetupStep3Title');
    await fireEvent.press(screen.getByTestId('SmartSetupFinish'));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            defaultCategories: expect.arrayContaining([
              expect.objectContaining({ id: 'cat-1', name: 'Rent' }),
            ]),
          }),
        }),
      );
    });
  });

  it('categories from API without ids get unique local ids so sliders are independent', async () => {
    // The real API returns CategoryWithPercentageDTO which has no Id field.
    // Without a local-id fallback every category gets id=undefined and all
    // sliders share the same key, making every percentage update hit them all.
    const hookMocks = require('../../../hooks/useSmartSetup') as {
      useDefaultCategories: jest.Mock;
    };
    hookMocks.useDefaultCategories.mockReturnValueOnce({
      data: [
        { name: 'Housing', percentage: 60 } as import('../../../api/types').DefaultCategory,
        { name: 'Food', percentage: 40 } as import('../../../api/types').DefaultCategory,
      ],
      isLoading: false,
    });

    await render(<SmartSetupScreen navigation={mockNavigation} route={mockRoute} />);
    await goToStep2();

    const nameInputs = screen.getAllByTestId(/-name$/);
    const ids = nameInputs.map((el) => el.props.testID.replace('-name', ''));

    // Each category must have a unique, non-"undefined" id
    expect(ids[0]).not.toBe('undefined');
    expect(ids[1]).not.toBe('undefined');
    expect(ids[0]).not.toBe(ids[1]);
  });
});
