import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PlanDetailScreen } from '../PlanDetailScreen';
import type { Plan, PlanEntry } from '../../../api/types';

// ─── Sentry mock ──────────────────────────────────────────────────────────────

const mockCaptureError = jest.fn();
jest.mock('../../../monitoring/sentry', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

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
    customColors: { income: '#2ecc71', expense: '#e74c3c' },
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

jest.mock('../../../components/common/LoadingIndicator', () => ({
  LoadingIndicator: () => null,
}));

jest.mock('../../../components/common/ErrorBanner', () => ({
  ErrorBanner: () => null,
}));

jest.mock('../../../components/common/DonutRing', () => ({
  DonutRing: () => null,
}));

jest.mock('../../../components/plans/PlanEntryRow', () => ({
  PlanEntryRow: jest.fn(() => null),
}));

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

jest.mock('react-native-svg', () => ({
  Svg: 'Svg',
  Circle: 'Circle',
}));

// ─── Store / hook mocks ───────────────────────────────────────────────────────

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(),
}));

const MOCK_PLAN: Plan = {
  id: 'plan-1',
  projectId: 'proj-1',
  type: 'Saving',
  name: 'Vacation Fund',
  targetAmount: 2000,
  currentBalance: 800,
  remaining: 1200,
  progress: 0.4,
  isArchived: false,
};

const MOCK_ENTRY: PlanEntry = {
  id: 'e-1',
  planId: 'plan-1',
  date: '2026-06-10',
  amountSigned: 500,
  note: 'First deposit',
};

jest.mock('../../../hooks/usePlans', () => ({
  usePlans: jest.fn(() => ({ data: [MOCK_PLAN] })),
  usePlanEntries: jest.fn(() => ({
    data: [MOCK_ENTRY],
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as unknown as React.ComponentProps<typeof PlanDetailScreen>['navigation'];

const mockRoute = {
  params: { planId: 'plan-1', planName: 'Vacation Fund' },
} as unknown as React.ComponentProps<typeof PlanDetailScreen>['route'];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlanDetailScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCaptureError.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockReturnValue({
      selectedProject: {
        id: 'up-1',
        role: 'Manager',
        project: { id: 'proj-1', name: 'Test', preferredCurrency: 'EUR', isArchived: false },
      },
      currency: 'EUR',
    });
    // reset hooks to default non-error state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePlans.mockReturnValue({ data: [MOCK_PLAN], error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePlanEntries.mockReturnValue({
      data: [MOCK_ENTRY],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it('shows the plan name in the header', async () => {
    await act(async () => {
      render(<PlanDetailScreen navigation={mockNavigation} route={mockRoute} />);
    });
    expect(screen.getByText('Vacation Fund')).toBeTruthy();
  });

  it('renders PlanEntryRow for each entry', async () => {
    await act(async () => {
      render(<PlanDetailScreen navigation={mockNavigation} route={mockRoute} />);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PlanEntryRow = (jest.requireMock('../../../components/plans/PlanEntryRow') as any).PlanEntryRow;
    expect(PlanEntryRow.mock.calls.length).toBeGreaterThan(0);
    expect(PlanEntryRow.mock.calls[0][0].entry.id).toBe('e-1');
  });

  it('navigates to PlanEntryForm when Add Entry button is pressed', async () => {
    await act(async () => {
      render(<PlanDetailScreen navigation={mockNavigation} route={mockRoute} />);
    });
    fireEvent.press(screen.getByTestId('btn-PlanAdjustBalance'));
    expect(mockNavigate).toHaveBeenCalledWith('PlanEntryForm', {
      planId: 'plan-1',
      planName: 'Vacation Fund',
    });
  });

  it('shows empty state when no entries', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePlanEntries.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<PlanDetailScreen navigation={mockNavigation} route={mockRoute} />);
    });
    expect(screen.getByText('NoPlanEntriesYet')).toBeTruthy();
  });

  it('calls captureError when usePlans query returns an error', async () => {
    const plansError = new Error('plans fetch failed');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePlans.mockReturnValue({
      data: undefined,
      error: plansError,
    });

    await act(async () => {
      render(<PlanDetailScreen navigation={mockNavigation} route={mockRoute} />);
    });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ screen: 'PlanDetailScreen', action: 'fetchPlans' }),
      ),
    );
  });

  it('has a centered title with no right-side edit button', async () => {
    await act(async () => {
      render(<PlanDetailScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // Currently: headerTitle style has NO textAlign: 'center' (test fails)
    // After fix: headerTitle includes textAlign: 'center' (test passes)
    const title = screen.getByText('Vacation Fund');
    expect(title.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ textAlign: 'center' }),
      ]),
    );
  });

  it('calls captureError when usePlanEntries query returns an error', async () => {
    const entriesError = new Error('entries fetch failed');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePlanEntries.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: entriesError,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<PlanDetailScreen navigation={mockNavigation} route={mockRoute} />);
    });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ screen: 'PlanDetailScreen', action: 'fetchPlanEntries' }),
      ),
    );
  });
});
