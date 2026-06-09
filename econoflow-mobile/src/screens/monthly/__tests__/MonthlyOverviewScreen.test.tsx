/**
 * Tests that the archive-category capability added to MonthlyOverviewScreen
 * (useArchiveCategory + UndoToast + swipe props forwarded to CategoryCard) is
 * correctly wired for each role.
 */
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { MonthlyOverviewScreen } from '../MonthlyOverviewScreen';
import type { Category } from '../../../api/types';

// ─── Common UI mocks ──────────────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  setOptions: jest.fn(),
  getParent: jest.fn(() => ({ navigate: jest.fn() })),
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
});
