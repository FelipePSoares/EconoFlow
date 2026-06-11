import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ExpenseListScreen } from '../ExpenseListScreen';
import type { Expense, ExpenseItem } from '../../../api/types';

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

const MockSwipeableRow = jest.fn(
  (_props: { onAction?: () => void; disabled?: boolean; children?: unknown }) => null,
);
jest.mock('../../../components/common/SwipeableRow', () => {
  const React = require('react');
  return {
    SwipeableRow: (props: unknown) => {
      MockSwipeableRow(props as Record<string, unknown>);
      return React.createElement(
        React.Fragment,
        null,
        (props as Record<string, unknown>).children,
      );
    },
  };
});

const MockUndoToast = jest.fn(
  (_props: { visible?: boolean; onUndo?: () => void; onDismiss?: () => void; message?: string }) => null,
);
jest.mock('../../../components/common/UndoToast', () => ({
  UndoToast: (props: unknown) => MockUndoToast(props as { visible?: boolean; onUndo?: () => void; onDismiss?: () => void; message?: string }),
}));

jest.mock('../../../components/common/DonutRing', () => ({
  DonutRing: () => null,
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

jest.mock('../../../utils/budget', () => ({
  toggleSetItem: jest.fn((set: Set<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  }),
  calculateExpensesOverspend: jest.fn(() => 0),
}));

jest.mock('../../../utils/categoryTheme', () => ({
  getCategoryColor: jest.fn(() => '#e74c3c'),
}));

jest.mock('../../../utils/categoryIcon', () => ({
  getCategoryIcon: jest.fn(() => 'food'),
}));

jest.mock('../../../utils/currency', () => ({
  getCurrencySymbol: jest.fn(() => '€'),
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
    selector({ setCategoryId: jest.fn(), setViewedMonth: jest.fn() }),
  ),
}));

const mockDeleteExpenseMutate = jest.fn();
const mockDeleteExpenseItemMutate = jest.fn();
const mockRestoreExpenseMutate = jest.fn();
const mockRestoreExpenseItemMutate = jest.fn();

jest.mock('../../../hooks/useExpenses', () => ({
  useExpensesForMonth: jest.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
  useDeleteExpense: jest.fn(() => ({ mutate: mockDeleteExpenseMutate })),
  useDeleteExpenseItem: jest.fn(() => ({ mutate: mockDeleteExpenseItemMutate })),
  useRestoreExpense: jest.fn(() => ({ mutate: mockRestoreExpenseMutate })),
  useRestoreExpenseItem: jest.fn(() => ({ mutate: mockRestoreExpenseItemMutate })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockGoBack = jest.fn();
const mockNavigation = {
  goBack: mockGoBack,
} as unknown as React.ComponentProps<typeof ExpenseListScreen>['navigation'];

const mockRoute = {
  key: 'ExpenseList',
  name: 'ExpenseList' as const,
  params: {
    categoryId: 'cat-1',
    categoryName: 'Food',
    month: '2024-01',
    categoryIndex: 0,
  },
} as unknown as React.ComponentProps<typeof ExpenseListScreen>['route'];

// ─── Test data ────────────────────────────────────────────────────────────────

const MOCK_EXPENSE: Expense = {
  id: 'exp-1',
  name: 'Lunch',
  amount: 15,
  budget: 20,
  date: '2024-01-15',
  isDeductible: false,
  items: [],
  attachments: [],
};

const MOCK_ITEM: ExpenseItem = {
  id: 'item-1',
  name: 'Coffee',
  amount: 5,
  date: '2024-01-15',
  isDeductible: false,
  attachments: [],
};

const MOCK_EXPENSE_WITH_ITEMS: Expense = {
  ...MOCK_EXPENSE,
  amount: 5,
  items: [MOCK_ITEM],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExpenseListScreen — captureError', () => {
  beforeEach(() => {
    MockSwipeableRow.mockReset();
    MockUndoToast.mockReset();
    mockDeleteExpenseMutate.mockReset();
    mockDeleteExpenseItemMutate.mockReset();
    mockRestoreExpenseMutate.mockReset();
    mockRestoreExpenseItemMutate.mockReset();
    mockGoBack.mockReset();
    mockCaptureError.mockReset();

    // reset to healthy state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useExpenses') as any).useExpensesForMonth.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useExpenses') as any).useDeleteExpense.mockReturnValue({
      mutate: mockDeleteExpenseMutate,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useExpenses') as any).useRestoreExpense.mockReturnValue({
      mutate: mockRestoreExpenseMutate,
    });
  });

  it('calls captureError with fetchExpenses action when query returns an error', async () => {
    const fetchError = new Error('network error');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useExpenses') as any).useExpensesForMonth.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: fetchError,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<ExpenseListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        fetchError,
        expect.objectContaining({ screen: 'ExpenseListScreen', action: 'fetchExpenses' }),
      ),
    );
  });

  it('calls captureError with deleteExpense action when deleteExpense mutation fails', async () => {
    const deleteError = new Error('delete failed');
    mockDeleteExpenseMutate.mockImplementation(
      (_id: string, opts?: { onError?: (e: unknown) => void }) => {
        opts?.onError?.(deleteError);
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useExpenses') as any).useExpensesForMonth.mockReturnValue({
      data: [MOCK_EXPENSE],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<ExpenseListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // Trigger the swipeable row's onAction (delete)
    const swipeableCall = MockSwipeableRow.mock.calls.find(
      (call) => typeof call[0]?.onAction === 'function',
    );
    expect(swipeableCall).toBeTruthy();
    const onAction = swipeableCall![0].onAction!;

    await act(async () => { onAction(); });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        deleteError,
        expect.objectContaining({ screen: 'ExpenseListScreen', action: 'deleteExpense' }),
      ),
    );
  });

  it('calls captureError with restoreExpense action when restoreExpense mutation fails', async () => {
    const restoreError = new Error('restore failed');
    mockRestoreExpenseMutate.mockImplementation(
      (_id: string, opts?: { onError?: (e: unknown) => void }) => {
        opts?.onError?.(restoreError);
      },
    );

    await act(async () => {
      render(<ExpenseListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // Trigger the UndoToast onUndo callback (restoreExpense is called from there)
    const undoCall = MockUndoToast.mock.calls[MockUndoToast.mock.calls.length - 1];
    expect(undoCall).toBeTruthy();

    // Set up undo state by triggering a delete first (to populate expenseId)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useExpenses') as any).useExpensesForMonth.mockReturnValue({
      data: [MOCK_EXPENSE],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    mockDeleteExpenseMutate.mockImplementation(jest.fn()); // no-op for delete

    // Re-render with expense data
    MockSwipeableRow.mockReset();
    MockUndoToast.mockReset();

    await act(async () => {
      render(<ExpenseListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // Trigger delete to set undoState
    const swipeableCall = MockSwipeableRow.mock.calls.find(
      (call) => typeof call[0]?.onAction === 'function',
    );
    expect(swipeableCall).toBeTruthy();
    await act(async () => { swipeableCall![0].onAction!(); });

    // Now trigger undo (restoreExpense)
    const latestUndoCall = MockUndoToast.mock.calls[MockUndoToast.mock.calls.length - 1];
    expect(latestUndoCall).toBeTruthy();
    const latestOnUndo = latestUndoCall[0]?.onUndo!;

    await act(async () => { latestOnUndo(); });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        restoreError,
        expect.objectContaining({ screen: 'ExpenseListScreen', action: 'restoreExpense' }),
      ),
    );
  });

  it('calls captureError with deleteExpenseItem action when deleteExpenseItem mutation fails', async () => {
    const deleteItemError = new Error('delete item failed');
    mockDeleteExpenseItemMutate.mockImplementation(
      (_data: unknown, opts?: { onError?: (e: unknown) => void }) => {
        opts?.onError?.(deleteItemError);
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useExpenses') as any).useExpensesForMonth.mockReturnValue({
      data: [MOCK_EXPENSE_WITH_ITEMS],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<ExpenseListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // Expand the expense group to reveal its items
    MockSwipeableRow.mockClear();
    await act(async () => {
      fireEvent.press(screen.getByTestId('expand-exp-1'));
    });

    // The item-level SwipeableRow is the last call after expansion
    const allCalls = MockSwipeableRow.mock.calls.filter(
      (call) => typeof call[0]?.onAction === 'function',
    );
    const itemCall = allCalls.at(-1);
    expect(itemCall).toBeTruthy();

    await act(async () => { itemCall![0].onAction!(); });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        deleteItemError,
        expect.objectContaining({ screen: 'ExpenseListScreen', action: 'deleteExpenseItem' }),
      ),
    );
  });

  it('calls captureError with restoreExpenseItem action when restoreExpenseItem mutation fails', async () => {
    const restoreItemError = new Error('restore item failed');
    mockRestoreExpenseItemMutate.mockImplementation(
      (_data: unknown, opts?: { onError?: (e: unknown) => void }) => {
        opts?.onError?.(restoreItemError);
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useExpenses') as any).useExpensesForMonth.mockReturnValue({
      data: [MOCK_EXPENSE_WITH_ITEMS],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    mockDeleteExpenseItemMutate.mockImplementation(jest.fn()); // no-op delete item

    await act(async () => {
      render(<ExpenseListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // Expand the expense group to reveal items
    MockSwipeableRow.mockClear();
    await act(async () => {
      fireEvent.press(screen.getByTestId('expand-exp-1'));
    });

    // Trigger item delete to populate undoState with both expenseId and itemId
    const allCalls = MockSwipeableRow.mock.calls.filter(
      (call) => typeof call[0]?.onAction === 'function',
    );
    const itemCall = allCalls.at(-1);
    expect(itemCall).toBeTruthy();
    await act(async () => { itemCall![0].onAction!(); });

    // Trigger undo — because undoState has itemId, restoreExpenseItem.mutate is called
    const latestUndoCall = MockUndoToast.mock.calls[MockUndoToast.mock.calls.length - 1];
    expect(latestUndoCall).toBeTruthy();
    const onUndo: () => void = latestUndoCall[0]?.onUndo!;
    expect(onUndo).toBeDefined();

    await act(async () => { onUndo(); });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        restoreItemError,
        expect.objectContaining({ screen: 'ExpenseListScreen', action: 'restoreExpenseItem' }),
      ),
    );
  });

  it('does not call captureError when query succeeds', async () => {
    await act(async () => {
      render(<ExpenseListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    expect(mockCaptureError).not.toHaveBeenCalled();
  });
});
