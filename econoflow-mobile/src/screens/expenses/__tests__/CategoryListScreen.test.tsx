import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { CategoryListScreen } from '../CategoryListScreen';

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

jest.mock('../../../components/common/MonthNavigator', () => ({
  MonthNavigator: () => null,
}));

const MockCategoryCard = jest.fn(
  (_props: { onSwipeAction?: () => void; [key: string]: unknown }) => null,
);
jest.mock('../../../components/budget/CategoryCard', () => ({
  CategoryCard: (props: unknown) => MockCategoryCard(props as Record<string, unknown>),
}));

const MockUndoToast = jest.fn(
  (_props: { visible?: boolean; onUndo?: () => void; onDismiss?: () => void; message?: string }) => null,
);
jest.mock('../../../components/common/UndoToast', () => ({
  UndoToast: (props: unknown) => MockUndoToast(props as { visible?: boolean; onUndo?: () => void; onDismiss?: () => void; message?: string }),
}));

jest.mock('../../../utils/budget', () => ({
  calculateTotalBudget: jest.fn(() => 0),
  calculateTotalExpenses: jest.fn(() => 0),
  calculateTotalOverspend: jest.fn(() => 0),
  calculateRemainingBudget: jest.fn(() => 0),
}));

jest.mock('../../../utils/currency', () => ({
  getCurrencySymbol: jest.fn(() => '€'),
}));

jest.mock('@react-navigation/native', () => ({
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
    selector({ setViewedMonth: jest.fn() }),
  ),
}));

const mockArchiveMutate = jest.fn();
const mockUnarchiveMutate = jest.fn();

jest.mock('../../../hooks/useCategories', () => ({
  useCategoriesForMonth: jest.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: jest.fn(),
  })),
  useArchiveCategory: jest.fn(() => ({ mutate: mockArchiveMutate })),
  useUnarchiveCategory: jest.fn(() => ({ mutate: mockUnarchiveMutate })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as unknown as React.ComponentProps<typeof CategoryListScreen>['navigation'];

const mockRoute = {
  key: 'CategoryList',
  name: 'CategoryList' as const,
  params: { month: '2024-01' },
} as unknown as React.ComponentProps<typeof CategoryListScreen>['route'];

// ─── Test data ────────────────────────────────────────────────────────────────

const MOCK_CATEGORY = {
  id: 'cat-1',
  name: 'Food',
  isArchived: false,
  budget: 500,
  totalExpenses: 200,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('CategoryListScreen — captureError', () => {
  beforeEach(() => {
    MockCategoryCard.mockReset();
    MockUndoToast.mockReset();
    mockArchiveMutate.mockReset();
    mockUnarchiveMutate.mockReset();
    mockNavigate.mockReset();
    mockGoBack.mockReset();
    mockCaptureError.mockReset();

    // reset to healthy state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useCategories') as any).useCategoriesForMonth.mockReturnValue({
      data: [],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useCategories') as any).useArchiveCategory.mockReturnValue({
      mutate: mockArchiveMutate,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useCategories') as any).useUnarchiveCategory.mockReturnValue({
      mutate: mockUnarchiveMutate,
    });
  });

  it('calls captureError with fetchCategories action when query returns an error', async () => {
    const fetchError = new Error('network error');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useCategories') as any).useCategoriesForMonth.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: fetchError,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<CategoryListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        fetchError,
        expect.objectContaining({ screen: 'CategoryListScreen', action: 'fetchCategories' }),
      ),
    );
  });

  it('calls captureError with archiveCategory action when archiveCategory mutation fails', async () => {
    const archiveError = new Error('archive failed');
    mockArchiveMutate.mockImplementation(
      (_id: string, opts?: { onError?: (e: unknown) => void }) => {
        opts?.onError?.(archiveError);
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useCategories') as any).useCategoriesForMonth.mockReturnValue({
      data: [MOCK_CATEGORY],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<CategoryListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // Find the CategoryCard's onSwipeAction and trigger it
    const cardCall = MockCategoryCard.mock.calls.find(
      (call) => typeof call[0]?.onSwipeAction === 'function',
    );
    expect(cardCall).toBeTruthy();
    const onSwipeAction: () => void = cardCall![0].onSwipeAction!;

    await act(async () => { onSwipeAction(); });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        archiveError,
        expect.objectContaining({ screen: 'CategoryListScreen', action: 'archiveCategory' }),
      ),
    );
  });

  it('calls captureError with unarchiveCategory action when unarchiveCategory mutation fails', async () => {
    const unarchiveError = new Error('unarchive failed');
    mockUnarchiveMutate.mockImplementation(
      (_id: string, opts?: { onError?: (e: unknown) => void }) => {
        opts?.onError?.(unarchiveError);
      },
    );

    // Render with a category so we can trigger archive → then undo (unarchive)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useCategories') as any).useCategoriesForMonth.mockReturnValue({
      data: [MOCK_CATEGORY],
      isLoading: false,
      isFetching: false,
      isError: false,
      error: null,
      refetch: jest.fn(),
    });
    mockArchiveMutate.mockImplementation(jest.fn()); // no-op archive

    await act(async () => {
      render(<CategoryListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    // Trigger archive to set undoState
    const cardCall = MockCategoryCard.mock.calls.find(
      (call) => typeof call[0]?.onSwipeAction === 'function',
    );
    expect(cardCall).toBeTruthy();
    await act(async () => { cardCall![0].onSwipeAction!(); });

    // Trigger undo (unarchive)
    const latestUndoCall = MockUndoToast.mock.calls[MockUndoToast.mock.calls.length - 1];
    expect(latestUndoCall).toBeTruthy();
    const onUndo: () => void = latestUndoCall[0]?.onUndo!;
    expect(onUndo).toBeDefined();

    await act(async () => { onUndo(); });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        unarchiveError,
        expect.objectContaining({ screen: 'CategoryListScreen', action: 'unarchiveCategory' }),
      ),
    );
  });

  it('does not call captureError when query succeeds', async () => {
    await act(async () => {
      render(<CategoryListScreen navigation={mockNavigation} route={mockRoute} />);
    });

    expect(mockCaptureError).not.toHaveBeenCalled();
  });
});
