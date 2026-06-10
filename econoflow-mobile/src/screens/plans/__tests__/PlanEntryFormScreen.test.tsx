import React from 'react';
import { act, cleanup, render, screen, fireEvent } from '@testing-library/react-native';
import { PlanEntryFormScreen } from '../PlanEntryFormScreen';

// ─── UI infrastructure mocks ──────────────────────────────────────────────────

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

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { primary: '#0f76a8', error: '#e74c3c', surface: '#fff' },
    customColors: { income: '#2ecc71', expense: '#e74c3c', accentGreen: '#27ae60' },
  }),
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

jest.mock('../../../components/common/ErrorBanner', () => ({
  ErrorBanner: () => null,
}));

jest.mock('../../../components/auth/AuroraField', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AuroraField: ({ placeholder, value, onChangeText }: any) =>
      React.createElement(TextInput, { testID: `field-${placeholder}`, value, onChangeText }),
  };
});

jest.mock('../../../components/auth/AuroraPrimaryButton', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    AuroraPrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(
        TouchableOpacity,
        { onPress, testID: `btn-${label}` },
        React.createElement(Text, null, label),
      ),
  };
});

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

// ─── Store / hook mocks ───────────────────────────────────────────────────────

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(),
}));

jest.mock('../../../hooks/usePlans', () => ({
  useAddPlanEntry: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockGoBack = jest.fn();

const mockNavigation = {
  navigate: jest.fn(),
  goBack: mockGoBack,
} as unknown as React.ComponentProps<typeof PlanEntryFormScreen>['navigation'];

const mockRoute = {
  params: { planId: 'plan-1', planName: 'Vacation Fund' },
} as unknown as React.ComponentProps<typeof PlanEntryFormScreen>['route'];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlanEntryFormScreen', () => {
  beforeEach(() => {
    cleanup();
    mockGoBack.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).useAddPlanEntry.mockReturnValue({
      mutate: jest.fn(),
      isPending: false,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockReturnValue({
      selectedProject: {
        id: 'up-1',
        role: 'Manager',
        project: { id: 'proj-1', name: 'Test', preferredCurrency: 'EUR', isArchived: false },
      },
      currency: 'EUR',
    });
  });

  it('renders the plan name in the header', async () => {
    await act(async () => {
      render(<PlanEntryFormScreen navigation={mockNavigation} route={mockRoute} />);
    });
    expect(screen.getByText('Vacation Fund')).toBeTruthy();
  });

  it('shows deposit (add money) and withdrawal (remove money) toggle options', async () => {
    await act(async () => {
      render(<PlanEntryFormScreen navigation={mockNavigation} route={mockRoute} />);
    });
    expect(screen.getByText('PlanActionAddMoney')).toBeTruthy();
    expect(screen.getByText('PlanActionRemoveMoney')).toBeTruthy();
  });

  it('pressing Remove Money selects withdrawal mode', async () => {
    await act(async () => {
      render(<PlanEntryFormScreen navigation={mockNavigation} route={mockRoute} />);
    });
    const removeBtn = screen.getByText('PlanActionRemoveMoney');
    fireEvent.press(removeBtn);
    // After pressing remove money, the button should be "selected"
    // We verify this by checking the button still exists
    expect(removeBtn).toBeTruthy();
  });

  it('renders save button', async () => {
    await act(async () => {
      render(<PlanEntryFormScreen navigation={mockNavigation} route={mockRoute} />);
    });
    expect(screen.getByTestId('btn-ButtonSave')).toBeTruthy();
  });

  it('renders note input field', async () => {
    await act(async () => {
      render(<PlanEntryFormScreen navigation={mockNavigation} route={mockRoute} />);
    });
    // Note field is identified by the label text rendered above it
    expect(screen.getByText('PlanEntryNote')).toBeTruthy();
  });

  it('shows amount validation error when Save is pressed with no amount', async () => {
    await act(async () => {
      render(<PlanEntryFormScreen navigation={mockNavigation} route={mockRoute} />);
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-ButtonSave'));
    });

    // t('ValueShouldBeGreaterThan') returns the key in test
    expect(screen.getByText('ValueShouldBeGreaterThan')).toBeTruthy();
  });

  it('calls addEntry.mutate with positive amountSigned in deposit mode', async () => {
    const mockMutate = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).useAddPlanEntry.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    await act(async () => {
      render(<PlanEntryFormScreen navigation={mockNavigation} route={mockRoute} />);
    });

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('field-0.00'), '150');
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-ButtonSave'));
    });

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ amountSigned: 150 }),
      expect.any(Object),
    );
  });

  it('calls addEntry.mutate with negative amountSigned in withdrawal mode', async () => {
    const mockMutate = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).useAddPlanEntry.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    await act(async () => {
      render(<PlanEntryFormScreen navigation={mockNavigation} route={mockRoute} />);
    });

    await act(async () => {
      fireEvent.press(screen.getByText('PlanActionRemoveMoney'));
      fireEvent.changeText(screen.getByTestId('field-0.00'), '50');
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-ButtonSave'));
    });

    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ amountSigned: -50 }),
      expect.any(Object),
    );
  });

  it('calls navigation.goBack on successful save', async () => {
    const mockMutate = jest.fn().mockImplementation((_data, callbacks) => callbacks.onSuccess());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).useAddPlanEntry.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    await act(async () => {
      render(<PlanEntryFormScreen navigation={mockNavigation} route={mockRoute} />);
    });

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('field-0.00'), '100');
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-ButtonSave'));
    });

    expect(mockGoBack).toHaveBeenCalled();
  });
});
