import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { PlanCard } from '../PlanCard';
import type { Plan } from '../../../api/types';

// ─── UI infrastructure mocks ──────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
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
  auroraTokens: () => ({ ink: '#000', ink2: '#666' }),
}));

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { primary: '#0f76a8', error: '#e74c3c', surface: '#fff' },
    customColors: { income: '#2ecc71', expense: '#e74c3c' },
  }),
}));

jest.mock('../../common/GlassCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassCard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('../../common/SwipeableRow', () => ({
  SwipeableRow: jest.fn(({ children }: { children: React.ReactNode }) => children),
}));

jest.mock('../../common/DonutRing', () => ({
  DonutRing: () => null,
}));

jest.mock('react-native-svg', () => ({
  Svg: 'Svg',
  Circle: 'Circle',
}));

// ─── Test data ────────────────────────────────────────────────────────────────

const MOCK_SAVING_PLAN: Plan = {
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

const MOCK_EMERGENCY_PLAN: Plan = {
  id: 'plan-2',
  projectId: 'proj-1',
  type: 'EmergencyReserve',
  name: 'Emergency Reserve',
  targetAmount: 5000,
  currentBalance: 5000,
  remaining: 0,
  progress: 1,
  isArchived: false,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlanCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the plan name', async () => {
    await act(async () => {
      render(<PlanCard plan={MOCK_SAVING_PLAN} onPress={jest.fn()} />);
    });
    expect(screen.getByText('Vacation Fund')).toBeTruthy();
  });

  it('shows the Savings type badge key', async () => {
    await act(async () => {
      render(<PlanCard plan={MOCK_SAVING_PLAN} onPress={jest.fn()} />);
    });
    expect(screen.getByText('PlanTypeSaving')).toBeTruthy();
  });

  it('shows the EmergencyReserve type badge key', async () => {
    await act(async () => {
      render(<PlanCard plan={MOCK_EMERGENCY_PLAN} onPress={jest.fn()} />);
    });
    expect(screen.getByText('PlanTypeEmergencyReserve')).toBeTruthy();
  });

  it('passes onSwipeAction to SwipeableRow when provided', async () => {
    const onSwipe = jest.fn();
    await act(async () => {
      render(
        <PlanCard plan={MOCK_SAVING_PLAN} onPress={jest.fn()} onSwipeAction={onSwipe} />,
      );
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SwipeableRow = (jest.requireMock('../../common/SwipeableRow') as any).SwipeableRow;
    const calls = SwipeableRow.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(typeof calls[0][0].onAction).toBe('function');
  });

  it('renders without swipe when onSwipeAction is omitted', async () => {
    await act(async () => {
      render(<PlanCard plan={MOCK_SAVING_PLAN} onPress={jest.fn()} />);
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SwipeableRow = (jest.requireMock('../../common/SwipeableRow') as any).SwipeableRow;
    expect(SwipeableRow.mock.calls.length).toBe(0);
  });
});
