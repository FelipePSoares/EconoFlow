import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { IncomeListScreen } from '../IncomeListScreen';

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

jest.mock('i18next', () => ({ language: 'en' }));

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
    colors: { primary: '#0f76a8', error: '#e74c3c' },
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

const renderSwipeableRow = (props: { children?: React.ReactNode }) =>
  React.createElement(require('react-native').View, null, props.children ?? null);

const MockSwipeableRow = jest.fn(
  (props: { onAction?: () => void; disabled?: boolean; children?: React.ReactNode; [key: string]: unknown }) =>
    renderSwipeableRow(props),
);
jest.mock('../../../components/common/SwipeableRow', () => ({
  SwipeableRow: (props: unknown) => MockSwipeableRow(props as Record<string, unknown>),
}));

const MockUndoToast = jest.fn(
  (_props: { visible?: boolean; onUndo?: () => void; onDismiss?: () => void; message?: string }) => null,
);
jest.mock('../../../components/common/UndoToast', () => ({
  UndoToast: (props: unknown) => MockUndoToast(props as { visible?: boolean; onUndo?: () => void; onDismiss?: () => void; message?: string }),
}));

jest.mock('../../../components/common/MonthNavigator', () => ({
  MonthNavigator: () => null,
}));

jest.mock('../../quick-add/QuickAddModal', () => ({
  QuickAddModal: () => null,
}));

jest.mock('../../../utils/date', () => ({
  fromDateOnly: jest.fn(() => new Date('2024-01-15')),
  formatMonthLabel: jest.fn(() => 'January 2024'),
}));

jest.mock('../../../utils/currency', () => ({
  getCurrencySymbol: jest.fn(() => '€'),
}));

jest.mock('../../../utils/categoryIcon', () => ({
  getCategoryIcon: jest.fn(() => 'cash'),
}));

jest.mock('../../../utils/format', () => ({
  formatAmount: jest.fn((n: number) => String(n)),
}));

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
  useIsFocused: jest.fn(() => true),
}));

// ─── Store / hook mocks ───────────────────────────────────────────────────────

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(() => ({
    selectedProject: { project: { id: 'proj-1' }, role: 'Manager' },
    currency: 'EUR',
  })),
}));

jest.mock('../../../store/quickAddStore', () => ({
  useQuickAddStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ setDefaultType: jest.fn(), setViewedMonth: jest.fn() }),
  ),
}));

const mockDeleteIncomeMutate = jest.fn();
const mockRestoreIncomeMutate = jest.fn();

jest.mock('../../../hooks/useIncomes', () => ({
  useIncomesForMonth: jest.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
  useDeleteIncome: jest.fn(() => ({ mutate: mockDeleteIncomeMutate })),
  useRestoreIncome: jest.fn(() => ({ mutate: mockRestoreIncomeMutate })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockNavigation = {
  goBack: mockGoBack,
  navigate: mockNavigate,
} as unknown as React.ComponentProps<typeof IncomeListScreen>['navigation'];

const mockRoute = {
  key: 'IncomeList',
  name: 'IncomeList' as const,
  params: { month: '2024-01' },
} as unknown as React.ComponentProps<typeof IncomeListScreen>['route'];

// ─── Test data ────────────────────────────────────────────────────────────────

const MOCK_INCOME = {
  id: 'inc-1',
  name: 'Salary',
  amount: 2000,
  date: '2024-01-01',
  attachments: [],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IncomeListScreen — captureError', () => {
  beforeEach(() => {
    MockSwipeableRow.mockReset();
    MockUndoToast.mockReset();
    mockDeleteIncomeMutate.mockReset();
    mockRestoreIncomeMutate.mockReset();
    mockGoBack.mockReset();
    mockCaptureError.mockReset();

    // reset to healthy state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useIncomes') as any).useIncomesForMonth.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useIncomes') as any).useDeleteIncome.mockReturnValue({
      mutate: mockDeleteIncomeMutate,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useIncomes') as any).useRestoreIncome.mockReturnValue({
      mutate: mockRestoreIncomeMutate,
    });
  });

  it('calls captureError with fetchIncomes action when query returns an error', async () => {
    const fetchError = new Error('network error');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useIncomes') as any).useIncomesForMonth.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: fetchError,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<IncomeListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        fetchError,
        expect.objectContaining({ screen: 'IncomeListScreen', action: 'fetchIncomes' }),
      ),
    );
  });

  it('calls captureError with deleteIncome action when deleteIncome mutation fails', async () => {
    const deleteError = new Error('delete failed');
    mockDeleteIncomeMutate.mockImplementation(
      (_id: string, opts?: { onError?: (e: unknown) => void }) => {
        opts?.onError?.(deleteError);
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useIncomes') as any).useIncomesForMonth.mockReturnValue({
      data: [MOCK_INCOME],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<IncomeListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // Find and trigger the SwipeableRow's onAction (delete income)
    const swipeableCall = MockSwipeableRow.mock.calls.find(
      (call) => typeof call[0]?.onAction === 'function',
    );
    expect(swipeableCall).toBeTruthy();
    const onAction: () => void = swipeableCall![0].onAction!;

    await act(async () => { onAction(); });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        deleteError,
        expect.objectContaining({ screen: 'IncomeListScreen', action: 'deleteIncome' }),
      ),
    );
  });

  it('calls captureError with restoreIncome action when restoreIncome mutation fails', async () => {
    const restoreError = new Error('restore failed');
    mockRestoreIncomeMutate.mockImplementation(
      (_id: string, opts?: { onError?: (e: unknown) => void }) => {
        opts?.onError?.(restoreError);
      },
    );

    // Render with an income item so undo state can be set
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useIncomes') as any).useIncomesForMonth.mockReturnValue({
      data: [MOCK_INCOME],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    mockDeleteIncomeMutate.mockImplementation(jest.fn()); // no-op delete

    await act(async () => {
      render(<IncomeListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // Trigger delete to set undoState with the income id
    const swipeableCall = MockSwipeableRow.mock.calls.find(
      (call) => typeof call[0]?.onAction === 'function',
    );
    expect(swipeableCall).toBeTruthy();
    await act(async () => { swipeableCall![0].onAction!(); });

    // Trigger undo which calls restoreIncome.mutate
    const latestUndoCall = MockUndoToast.mock.calls[MockUndoToast.mock.calls.length - 1];
    expect(latestUndoCall).toBeTruthy();
    const onUndo: () => void = latestUndoCall[0]?.onUndo!;
    expect(onUndo).toBeDefined();

    await act(async () => { onUndo(); });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        restoreError,
        expect.objectContaining({ screen: 'IncomeListScreen', action: 'restoreIncome' }),
      ),
    );
  });

  it('does not call captureError when query succeeds', async () => {
    await act(async () => {
      render(<IncomeListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    expect(mockCaptureError).not.toHaveBeenCalled();
  });
});

// ─── Attachments entry point ──────────────────────────────────────────────────

describe('IncomeListScreen — attachments entry point', () => {
  const setIncomes = (incomes: unknown[]) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useIncomes') as any).useIncomesForMonth.mockReturnValue({
      data: incomes,
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
  };

  const setRole = (role: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockReturnValue({
      selectedProject: { project: { id: 'proj-1' }, role },
      currency: 'EUR',
    });
  };

  const attachment = {
    id: 'att-1',
    name: 'payslip.pdf',
    contentType: 'application/pdf',
    size: 2048,
    attachmentType: 'General',
    isTemporary: false,
  };

  beforeEach(() => {
    // The captureError suite resets this mock, so restore the children-rendering
    // implementation before rendering rows.
    MockSwipeableRow.mockReset();
    MockSwipeableRow.mockImplementation(renderSwipeableRow as never);
    mockNavigate.mockReset();
    setRole('Manager');
    setIncomes([MOCK_INCOME]);
  });

  it('navigates to the attachments screen with the income payload', async () => {
    await render(<IncomeListScreen navigation={mockNavigation} route={mockRoute} />);

    await fireEvent.press(screen.getByTestId('income-attachments-button'));

    expect(mockNavigate).toHaveBeenCalledWith('RecordAttachments', {
      kind: 'income',
      id: 'inc-1',
      month: '2024-01',
      title: 'Salary',
    });
  });

  it('hides the attachments entry point from viewers', async () => {
    setRole('Viewer');

    await render(<IncomeListScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.queryByTestId('income-attachments-button')).toBeNull();
  });

  it('shows the attachment count when the income has attachments', async () => {
    setIncomes([{ ...MOCK_INCOME, attachments: [attachment] }]);

    await render(<IncomeListScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.getByText('1')).toBeTruthy();
  });

  it('renders no attachment count when the income has none', async () => {
    await render(<IncomeListScreen navigation={mockNavigation} route={mockRoute} />);

    expect(screen.queryByText('1')).toBeNull();
  });
});
