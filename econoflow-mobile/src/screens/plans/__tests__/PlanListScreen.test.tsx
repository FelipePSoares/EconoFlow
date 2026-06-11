import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { PlanListScreen } from '../PlanListScreen';
import type { Plan } from '../../../api/types';

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

jest.mock('../../../components/plans/PlanCard', () => ({
  PlanCard: jest.fn(() => null),
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

// ─── Store / hook mocks ───────────────────────────────────────────────────────

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(),
}));

const mockArchiveMutate = jest.fn();

jest.mock('../../../hooks/usePlans', () => ({
  usePlans: jest.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: jest.fn(),
  })),
  useArchivePlan: jest.fn(() => ({ mutate: mockArchiveMutate })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockParentNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  getParent: jest.fn(() => ({ navigate: mockParentNavigate })),
} as unknown as React.ComponentProps<typeof PlanListScreen>['navigation'];

const mockRoute = {
  key: 'PlanList',
  name: 'PlanList',
  params: undefined,
} as unknown as React.ComponentProps<typeof PlanListScreen>['route'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeProjectStore(role: 'Admin' | 'Manager' | 'Viewer' = 'Manager') {
  return {
    selectedProject: {
      id: 'up-1',
      role,
      project: { id: 'proj-1', name: 'Test', preferredCurrency: 'EUR', isArchived: false },
    },
    currency: 'EUR',
  };
}

const MOCK_PLAN: Plan = {
  id: 'plan-1',
  projectId: 'proj-1',
  type: 'Savings',
  name: 'Vacation Fund',
  targetAmount: 2000,
  currentBalance: 800,
  remaining: 1200,
  progress: 0.4,
  isArchived: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlanListScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockArchiveMutate.mockReset();
    mockParentNavigate.mockReset();
    mockCaptureError.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockReturnValue(makeProjectStore());
    // reset usePlans to a default non-error state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePlans.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  it('shows empty state when there are no plans', async () => {
    await act(async () => {
      render(<PlanListScreen navigation={mockNavigation} route={mockRoute} />);
    });
    expect(screen.getByText('NoPlansYet')).toBeTruthy();
  });

  it('renders PlanCard for each active plan', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePlans.mockReturnValue({
      data: [MOCK_PLAN],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<PlanListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PlanCard = (jest.requireMock('../../../components/plans/PlanCard') as any).PlanCard;
    expect(PlanCard.mock.calls.length).toBeGreaterThan(0);
    expect(PlanCard.mock.calls[0][0].plan.id).toBe('plan-1');
  });

  it('navigates to PlanForm when create button is pressed', async () => {
    await act(async () => {
      render(<PlanListScreen navigation={mockNavigation} route={mockRoute} />);
    });
    fireEvent.press(screen.getByTestId('btn-CreatePlan'));
    expect(mockNavigate).toHaveBeenCalledWith('PlanForm', {});
  });

  it('calls archivePlan.mutate when swipe action is triggered', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePlans.mockReturnValue({
      data: [MOCK_PLAN],
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<PlanListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PlanCard = (jest.requireMock('../../../components/plans/PlanCard') as any).PlanCard;
    const swipeAction: () => void = PlanCard.mock.calls[0][0].onSwipeAction;
    await act(async () => { swipeAction(); });

    expect(mockArchiveMutate).toHaveBeenCalledWith('plan-1');
  });

  it('does not render header top-right create button', async () => {
    await act(async () => {
      render(<PlanListScreen navigation={mockNavigation} route={mockRoute} />);
    });
    expect(screen.queryByTestId('header-create-btn')).toBeNull();
  });

  it('renders a back button in the header', async () => {
    await act(async () => {
      render(<PlanListScreen navigation={mockNavigation} route={mockRoute} />);
    });
    expect(screen.getByTestId('header-back-btn')).toBeTruthy();
  });

  it('pressing back button navigates to Overview tab', async () => {
    await act(async () => {
      render(<PlanListScreen navigation={mockNavigation} route={mockRoute} />);
    });
    fireEvent.press(screen.getByTestId('header-back-btn'));
    expect(mockParentNavigate).toHaveBeenCalledWith('Overview');
  });

  it('renders a spacer to keep the title centred', async () => {
    await act(async () => {
      render(<PlanListScreen navigation={mockNavigation} route={mockRoute} />);
    });
    expect(screen.getByTestId('header-title-spacer')).toBeTruthy();
  });

  it('calls captureError when usePlans query returns an error', async () => {
    const fetchError = new Error('network error');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePlans.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: fetchError,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<PlanListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ screen: 'PlanListScreen', action: 'fetchPlans' }),
      ),
    );
  });

  it('calls captureError when archivePlan mutation fails', async () => {
    const archiveError = new Error('archive failed');
    const mockMutateWithError = jest.fn().mockImplementation((_id, opts) => {
      opts?.onError?.(archiveError);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePlans.mockReturnValue({
      data: [MOCK_PLAN],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).useArchivePlan.mockReturnValue({
      mutate: mockMutateWithError,
    });

    await act(async () => {
      render(<PlanListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const PlanCard = (jest.requireMock('../../../components/plans/PlanCard') as any).PlanCard;
    const swipeAction: () => void = PlanCard.mock.calls[0][0].onSwipeAction;
    await act(async () => { swipeAction(); });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ screen: 'PlanListScreen', action: 'archivePlan' }),
      ),
    );
  });
});
