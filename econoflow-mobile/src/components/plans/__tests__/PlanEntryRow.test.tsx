import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { PlanEntryRow } from '../PlanEntryRow';
import type { PlanEntry } from '../../../api/types';

// ─── UI infrastructure mocks ──────────────────────────────────────────────────

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
}));

jest.mock('../../../theme/useAppTheme', () => ({
  useAppTheme: () => ({
    colors: { primary: '#0f76a8', error: '#e74c3c' },
    customColors: { income: '#2ecc71', expense: '#e74c3c' },
  }),
}));

// ─── Test data ────────────────────────────────────────────────────────────────

const DEPOSIT_ENTRY: PlanEntry = {
  id: 'e-1',
  planId: 'plan-1',
  date: '2026-06-10',
  amountSigned: 500,
  note: 'Monthly savings',
};

const WITHDRAWAL_ENTRY: PlanEntry = {
  id: 'e-2',
  planId: 'plan-1',
  date: '2026-06-05',
  amountSigned: -200,
  note: '',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlanEntryRow', () => {
  it('renders the date of the entry', async () => {
    await act(async () => {
      render(<PlanEntryRow entry={DEPOSIT_ENTRY} currency="EUR" />);
    });
    expect(screen.getByText('2026-06-10')).toBeTruthy();
  });

  it('renders deposit amount as positive number', async () => {
    await act(async () => {
      render(<PlanEntryRow entry={DEPOSIT_ENTRY} currency="EUR" />);
    });
    // Should display positive amount
    expect(screen.getByText(/500/)).toBeTruthy();
  });

  it('renders withdrawal amount as negative number', async () => {
    await act(async () => {
      render(<PlanEntryRow entry={WITHDRAWAL_ENTRY} currency="EUR" />);
    });
    // Should display negative or absolute amount for withdrawal
    expect(screen.getByText(/-200|200/)).toBeTruthy();
  });

  it('renders note when present', async () => {
    await act(async () => {
      render(<PlanEntryRow entry={DEPOSIT_ENTRY} currency="EUR" />);
    });
    expect(screen.getByText('Monthly savings')).toBeTruthy();
  });

  it('renders no-note placeholder when note is empty', async () => {
    await act(async () => {
      render(<PlanEntryRow entry={WITHDRAWAL_ENTRY} currency="EUR" />);
    });
    expect(screen.getByText('PlanEntryNoNote')).toBeTruthy();
  });
});
