/**
 * Tests that the archive-category capability added to MonthlyOverviewScreen
 * (useArchiveCategory + UndoToast + swipe props forwarded to CategoryCard) is
 * correctly wired for each role.
 */
import React from 'react';
import { Dimensions } from 'react-native';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { MonthlyOverviewScreen } from '../MonthlyOverviewScreen';
import type { Category } from '../../../api/types';

// ─── Common UI mocks ──────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Scriptable, so a test can give the screen the insets a real device reports. It starts at
// zero: most cases here are about the archive capability, not the layout.
let mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => mockInsets,
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => false,
}));

jest.mock('../../../theme/useAuroraSkin', () => ({
  useAuroraSkin: () => ({ dark: false, ink: '#000', ink2: '#666', hair: '#ccc' }),
  auroraTokens: () => ({ ink: '#000', ink2: '#666' }),
}));

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { primary: '#0f76a8', error: '#e74c3c', surface: '#fff' },
    customColors: { income: '#2ecc71', expense: '#e74c3c' },
  }),
}));

jest.mock('../../../components/common/GlassScreen', () => ({
  GlassScreen: jest.fn(({ children }: { children: unknown }) => children),
}));

jest.mock('../../../components/common/GlassCard', () => ({
  GlassCard: jest.fn(({ children }: { children: unknown }) => children),
}));

jest.mock('../../../components/common/LoadingIndicator', () => ({
  LoadingIndicator: () => null,
}));

jest.mock('../../../components/common/ErrorBanner', () => ({
  ErrorBanner: () => null,
}));

jest.mock('../../../components/common/MonthNavigator', () => ({
  MonthNavigator: () => null,
}));

jest.mock('../../../components/common/DonutRing', () => ({
  DonutRing: () => null,
}));

jest.mock('../../../components/common/UndoToast', () => ({
  UndoToast: jest.fn(() => null),
}));

jest.mock('../../../components/budget/CategoryCard', () => ({
  CategoryCard: jest.fn(() => null),
}));

// ─── Sentry mock ─────────────────────────────────────────────────────────────

const mockCaptureError = jest.fn();
jest.mock('../../../monitoring/sentry', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

// ─── Store / hook mocks ───────────────────────────────────────────────────────

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(),
}));

jest.mock('../../../store/quickAddStore', () => ({
  useQuickAddStore: jest.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({ setViewedMonth: jest.fn(), setCategoryId: jest.fn() }),
  ),
}));

jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn(() => ({ user: { id: 'u1', email: 'test@test.com', firstName: 'Test', defaultProjectId: null } })),
}));

jest.mock('../../../hooks/useProjects', () => ({
  useProjects: jest.fn(() => ({ data: [] })),
}));

jest.mock('../../../hooks/useIncomes', () => ({
  useIncomesForMonth: jest.fn(() => ({
    data: [], isLoading: false, isFetching: false, isError: false, refetch: jest.fn(),
  })),
}));

jest.mock('../../../hooks/usePlans', () => ({
  useTotalSavedForMonth: jest.fn(() => ({ totalSaved: 0, isLoading: false })),
}));

const mockArchiveMutate = jest.fn();
const mockUnarchiveMutate = jest.fn();

jest.mock('../../../hooks/useCategories', () => ({
  useCategoriesForMonth: jest.fn(() => ({
    data: [
      {
        id: 'cat-1', name: 'Food', isArchived: false,
        displayOrder: 0, totalBudget: 100, totalWaste: 0, expenses: [],
      } as Category,
    ],
    isLoading: false, isFetching: false, isError: false, refetch: jest.fn(),
  })),
  useArchiveCategory: jest.fn(() => ({ mutate: mockArchiveMutate })),
  useUnarchiveCategory: jest.fn(() => ({ mutate: mockUnarchiveMutate })),
}));

jest.mock('../../../hooks/useNotifications', () => ({
  useNotifications: jest.fn(() => ({ data: [], isLoading: false })),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeProjectStore(role: 'Admin' | 'Manager' | 'Viewer') {
  return {
    selectedProject: {
      id: 'up-1',
      userId: 'u1',
      userName: 'Test',
      userEmail: 'test@test.com',
      accepted: true,
      role,
      project: { id: 'proj-1', name: 'Test Project', preferredCurrency: 'EUR', isArchived: false },
    },
    currency: 'EUR',
    setSelectedProject: jest.fn(),
    clearProject: jest.fn(),
  };
}

const mockParentNavigate = jest.fn();
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  getParent: jest.fn(() => ({ navigate: mockParentNavigate })),
} as unknown as React.ComponentProps<typeof MonthlyOverviewScreen>['navigation'];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getCategoryCardSpy = (): jest.Mock => (jest.requireMock('../../../components/budget/CategoryCard') as any).CategoryCard;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getUndoToastSpy = (): jest.Mock => (jest.requireMock('../../../components/common/UndoToast') as any).UndoToast;

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MonthlyOverviewScreen — archive-category capability', () => {
  beforeEach(() => {
    getCategoryCardSpy().mockClear();
    getUndoToastSpy().mockClear();
    mockParentNavigate.mockReset();
    mockCaptureError.mockReset();
  });

  it('passes onSwipeAction and swipeDisabled=false to CategoryCard for Manager role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockImplementation(() => makeProjectStore('Manager'));

    await act(async () => {
      render(<MonthlyOverviewScreen navigation={mockNavigation} />);
    });

    const calls = getCategoryCardSpy().mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const props = calls[0][0];
    expect(typeof props.onSwipeAction).toBe('function');
    expect(props.swipeDisabled).toBe(false);
  });

  it('passes swipeDisabled=true to CategoryCard for Viewer role', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockImplementation(() => makeProjectStore('Viewer'));

    await act(async () => {
      render(<MonthlyOverviewScreen navigation={mockNavigation} />);
    });

    const calls = getCategoryCardSpy().mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    const props = calls[0][0];
    expect(props.swipeDisabled).toBe(true);
  });

  it('renders UndoToast in the component tree', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockImplementation(() => makeProjectStore('Manager'));

    await act(async () => {
      render(<MonthlyOverviewScreen navigation={mockNavigation} />);
    });

    expect(getUndoToastSpy()).toHaveBeenCalled();
  });

  it('calls captureError when useCategoriesForMonth query has an error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockImplementation(() => makeProjectStore('Manager'));

    const err = new Error('Cats fetch failed');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useCategories') as any).useCategoriesForMonth.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: err,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<MonthlyOverviewScreen navigation={mockNavigation} />);
    });

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        err,
        { screen: 'MonthlyOverviewScreen', action: 'fetchCategories' },
      );
    });
  });

  it('calls captureError when useIncomesForMonth query has an error', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockImplementation(() => makeProjectStore('Manager'));

    const err = new Error('Incomes fetch failed');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useIncomes') as any).useIncomesForMonth.mockReturnValueOnce({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
      error: err,
      refetch: jest.fn(),
    });

    await act(async () => {
      render(<MonthlyOverviewScreen navigation={mockNavigation} />);
    });

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        err,
        { screen: 'MonthlyOverviewScreen', action: 'fetchIncomes' },
      );
    });
  });

  it('calls captureError with archiveCategory action when archive mutation errors', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockImplementation(() => makeProjectStore('Manager'));

    const err = new Error('Archive failed');
    const mockArchiveWithError = jest.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useCategories') as any).useArchiveCategory.mockReturnValueOnce({
      mutate: (_id: string, opts?: { onError?: (e: unknown) => void }) => {
        mockArchiveWithError();
        opts?.onError?.(err);
      },
    });

    await act(async () => {
      render(<MonthlyOverviewScreen navigation={mockNavigation} />);
    });

    const categoryCardProps = getCategoryCardSpy().mock.calls[0][0];
    await act(async () => {
      categoryCardProps.onSwipeAction();
    });

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        err,
        { screen: 'MonthlyOverviewScreen', action: 'archiveCategory' },
      );
    });
  });

  it('calls captureError with unarchiveCategory action when unarchive mutation errors', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockImplementation(() => makeProjectStore('Manager'));

    const err = new Error('Unarchive failed');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useCategories') as any).useUnarchiveCategory.mockReturnValue({
      mutate: (_id: string, opts?: { onError?: (e: unknown) => void }) => {
        opts?.onError?.(err);
      },
    });

    await act(async () => {
      render(<MonthlyOverviewScreen navigation={mockNavigation} />);
    });

    // First trigger a swipe to populate undoState.id so the undo call is guarded
    const categoryCardProps = getCategoryCardSpy().mock.calls[0][0];
    await act(async () => {
      categoryCardProps.onSwipeAction();
    });

    // UndoToast re-renders after swipe — use the latest call to get the updated onUndo closure
    const undoToastCalls = getUndoToastSpy().mock.calls;
    const latestUndoToastProps = undoToastCalls[undoToastCalls.length - 1][0];
    await act(async () => {
      latestUndoToastProps.onUndo();
    });

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        err,
        { screen: 'MonthlyOverviewScreen', action: 'unarchiveCategory' },
      );
    });
  });

  it('renders archived categories alongside active categories', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockImplementation(() => makeProjectStore('Manager'));

    const archiveCat = { id: 'cat-arch', name: 'Archived', isArchived: true, displayOrder: 1, totalBudget: 0, totalWaste: 0, expenses: [] } as Category;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useCategories') as any).useCategoriesForMonth.mockReturnValueOnce({
      data: [
        { id: 'cat-1', name: 'Food', isArchived: false, displayOrder: 0, totalBudget: 100, totalWaste: 0, expenses: [] } as Category,
        archiveCat,
      ],
      isLoading: false, isFetching: false, isError: false, refetch: jest.fn(),
    });

    await act(async () => {
      render(<MonthlyOverviewScreen navigation={mockNavigation} />);
    });

    const categoryCalls = getCategoryCardSpy().mock.calls;
    expect(categoryCalls.length).toBe(2);
    const archivedCall = categoryCalls.find(
      (call: unknown[]) => (call[0] as Record<string, unknown>)?.category && (call[0] as Record<string, Record<string, unknown>>)?.category?.isArchived === true,
    );
    expect(archivedCall).toBeTruthy();
  });

  it('pressing the saved panel navigates to the Plans tab', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockImplementation(() => makeProjectStore('Manager'));

    await act(async () => {
      render(<MonthlyOverviewScreen navigation={mockNavigation} />);
    });

    fireEvent.press(screen.getByTestId('saved-panel'));
    expect(mockParentNavigate).toHaveBeenCalledWith('Plans');
  });
});

describe('MonthlyOverviewScreen — top inset', () => {
  /**
   * The Overview once opened with its whole upper half blank: the first thing on screen was
   * the greeting, halfway down. The screen reads `insets.top` itself **and** the bottom-tabs
   * navigator already keeps the screen clear of the status bar, so the inset was applied
   * twice — and on a device whose inset is not the app window's (a cut-out, a display cutout
   * inset, a large gesture-bar inset) "twice" became most of the screen.
   *
   * The rule this pins: the screen honours the inset it is given, **once**, and never more
   * than the inset itself. Anything larger is the safe-area provider handing back a frame
   * that is not the app window, and the screen must not turn that into padding.
   */
  const renderWithInsets = async (insets: { top: number; bottom: number; left: number; right: number }) => {
    mockInsets = insets;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockImplementation(() => makeProjectStore('Manager'));

    await act(async () => {
      render(<MonthlyOverviewScreen navigation={mockNavigation} />);
    });
  };

  afterEach(() => {
    mockInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  });

  /**
   * The scroll content's top padding — the value that decides where the first row lands.
   * Read from the rendered tree by the id the screen gives its scroll view, because that is
   * the contract this repo uses for everything the tests need to reach.
   */
  const contentPaddingTop = (): number => {
    const scroll = screen.getByTestId('overview-scroll');
    const style = scroll.props.contentContainerStyle;
    return Array.isArray(style) ? Object.assign({}, ...style).paddingTop : style?.paddingTop;
  };

  it('reserves the top inset once, so the first row is what the screen shows', async () => {
    await renderWithInsets({ top: 96, bottom: 48, left: 0, right: 0 });

    expect(contentPaddingTop()).toBeLessThanOrEqual(96);
  });

  it('does not turn an inset larger than the window into a blank half-screen', async () => {
    // What a cut-out device reported: an inset that is not this window's top edge. The screen
    // must never pad by more than a fraction of its own height — that is what pushed the
    // first row into the middle of the screen and left the upper half empty.
    await renderWithInsets({ top: 700, bottom: 48, left: 0, right: 0 });

    const { height } = Dimensions.get('window');
    expect(contentPaddingTop()).toBeLessThanOrEqual(height * 0.2);
  });
});
