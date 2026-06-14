import React from 'react';
import { render, act, screen } from '@testing-library/react-native';
import { CategoryCard } from '../CategoryCard';
import type { Category } from '../../../api/types';

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { primary: '#0f76a8', error: '#e74c3c', surface: '#fff' },
    customColors: {},
  }),
}));

jest.mock('../../../theme/useAuroraSkin', () => ({
  useAuroraSkin: () => ({ dark: false, ink: '#000', ink2: '#666' }),
  auroraTokens: () => ({ ink: '#000', ink2: '#666' }),
}));

jest.mock('../../../components/common/GlassCard', () => ({
  GlassCard: jest.fn(({ children }: { children: unknown }) => children),
}));

jest.mock('../../../components/common/DonutRing', () => ({
  DonutRing: 'DonutRing',
}));

jest.mock('../../../components/common/SwipeableRow', () => ({
  SwipeableRow: jest.fn(() => null),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const makeCategory = (overrides?: Partial<Category>): Category => ({
  id: 'cat-1',
  name: 'Food',
  isArchived: false,
  displayOrder: 0,
  totalBudget: 100,
  totalWaste: 0,
  expenses: [
    {
      id: 'exp-1',
      name: 'Groceries',
      amount: 50,
      budget: 100,
      date: '2026-01-01',
      isDeductible: false,
      items: [],
      attachments: [],
      temporaryAttachmentIds: [],
    } as unknown as Category['expenses'][0],
  ],
  ...overrides,
});

const getSwipeableRowSpy = (): jest.Mock =>
  (jest.requireMock('../../../components/common/SwipeableRow') as any).SwipeableRow;

beforeEach(() => {
  getSwipeableRowSpy().mockClear();
});

describe('CategoryCard', () => {
  it('does NOT render a SwipeableRow when onSwipeAction is not provided', async () => {
    await act(async () => {
      render(<CategoryCard category={makeCategory()} currency="USD" onPress={jest.fn()} />);
    });
    expect(getSwipeableRowSpy()).not.toHaveBeenCalled();
  });

  it('renders a SwipeableRow when onSwipeAction is provided', async () => {
    await act(async () => {
      render(
        <CategoryCard
          category={makeCategory()}
          currency="USD"
          onPress={jest.fn()}
          onSwipeAction={jest.fn()}
          swipeActionColor="#aabbcc"
          swipeDisabled={false}
        />,
      );
    });
    expect(getSwipeableRowSpy()).toHaveBeenCalled();
  });

  it('does NOT render a SwipeableRow when category is archived even if onSwipeAction provided', async () => {
    await act(async () => {
      render(
        <CategoryCard
          category={makeCategory({ isArchived: true })}
          currency="USD"
          onPress={jest.fn()}
          onSwipeAction={jest.fn()}
          swipeActionColor="#aabbcc"
          swipeDisabled={false}
        />,
      );
    });

    expect(getSwipeableRowSpy()).not.toHaveBeenCalled();
  });

  it('renders the archived label when category is archived', async () => {
    await act(async () => {
      render(
        <CategoryCard
          category={makeCategory({ isArchived: true })}
          currency="USD"
          onPress={jest.fn()}
        />,
      );
    });

    expect(screen.getByText('Archived')).toBeTruthy();
  });

  it('renders with reduced opacity when category is archived', async () => {
    await act(async () => {
      render(
        <CategoryCard
          category={makeCategory({ isArchived: true })}
          currency="USD"
          onPress={jest.fn()}
        />,
      );
    });

    const archivedRow = screen.getByTestId('archived-category-row');
    expect(archivedRow.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ opacity: 0.55 })]),
    );
  });
});
