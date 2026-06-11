import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ExpenseFormScreen } from '../ExpenseFormScreen';

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

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Text, TextInput, TouchableOpacity, View } = require('react-native');
  return {
    Button: ({
      children,
      onPress,
      loading: _loading,
      testID,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      loading?: boolean;
      testID?: string;
    }) =>
      React.createElement(
        TouchableOpacity,
        { onPress, testID: testID ?? String(children) },
        React.createElement(Text, null, children),
      ),
    Checkbox: ({
      status,
      onPress,
    }: {
      status: string;
      onPress: () => void;
    }) =>
      React.createElement(TouchableOpacity, { onPress, testID: 'checkbox' },
        React.createElement(Text, null, status),
      ),
    HelperText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
    TextInput: ({
      label,
      value,
      onChangeText,
      testID,
    }: {
      label?: string;
      value?: string;
      onChangeText?: (t: string) => void;
      testID?: string;
    }) =>
      React.createElement(TextInput, {
        testID: testID ?? label,
        value,
        onChangeText,
      }),
    View: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('../../../components/common/ErrorBanner', () => ({
  ErrorBanner: () => null,
}));

// ─── Store / hook mocks ───────────────────────────────────────────────────────

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(() => ({
    selectedProject: { project: { id: 'proj-1' }, role: 'Manager' },
    currency: 'EUR',
  })),
}));

const mockCreateMutate = jest.fn();
const mockPatchMutate = jest.fn();

jest.mock('../../../hooks/useExpenses', () => ({
  useCreateExpense: jest.fn(() => ({
    mutate: mockCreateMutate,
    isPending: false,
  })),
  usePatchExpense: jest.fn(() => ({
    mutate: mockPatchMutate,
    isPending: false,
  })),
}));

jest.mock('../../../utils/date', () => ({
  toDateOnly: jest.fn(() => '2024-01-01'),
  fromDateOnly: jest.fn(() => new Date('2024-01-01')),
}));

jest.mock('../../../utils/patch', () => ({
  buildPatch: jest.fn((obj: Record<string, unknown>) => obj),
}));

jest.mock('../../../utils/apiErrors', () => ({
  extractApiErrors: jest.fn(() => ({})),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockGoBack = jest.fn();
const mockNavigation = {
  goBack: mockGoBack,
} as unknown as React.ComponentProps<typeof ExpenseFormScreen>['navigation'];

const makeRoute = (overrides = {}) =>
  ({
    key: 'ExpenseForm',
    name: 'ExpenseForm' as const,
    params: {
      categoryId: 'cat-1',
      month: '2024-01',
      ...overrides,
    },
  } as unknown as React.ComponentProps<typeof ExpenseFormScreen>['route']);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ExpenseFormScreen — captureError', () => {
  beforeEach(() => {
    mockCreateMutate.mockReset();
    mockPatchMutate.mockReset();
    mockGoBack.mockReset();
    mockCaptureError.mockReset();
  });

  it('calls captureError with createExpense action when createExpense mutation fails', async () => {
    const error = new Error('create failed');
    mockCreateMutate.mockImplementation((_data: unknown, opts?: { onError?: (e: unknown) => void }) => {
      opts?.onError?.(error);
    });

    await act(async () => {
      render(<ExpenseFormScreen navigation={mockNavigation} route={makeRoute()} />);
    });

    // Fill required name field so react-hook-form validation passes
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('FieldName'), 'Lunch');
    });

    // submit the form - wrap in act so all state updates are flushed
    await act(async () => {
      fireEvent.press(screen.getByTestId('ButtonAdd'));
    });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ screen: 'ExpenseFormScreen', action: 'createExpense' }),
      ),
    );
  });

  it('calls captureError with updateExpense action when patchExpense mutation fails', async () => {
    const error = new Error('patch failed');
    mockPatchMutate.mockImplementation((_data: unknown, opts?: { onError?: (e: unknown) => void }) => {
      opts?.onError?.(error);
    });

    await act(async () => {
      render(
        <ExpenseFormScreen
          navigation={mockNavigation}
          route={makeRoute({
            expenseId: 'exp-1',
            initialValues: { name: 'Test', amount: 10, budget: 0, isDeductible: false, date: '2024-01-01' },
          })}
        />,
      );
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('ButtonSave'));
    });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ screen: 'ExpenseFormScreen', action: 'updateExpense' }),
      ),
    );
  });

  it('does not call captureError when createExpense succeeds', async () => {
    mockCreateMutate.mockImplementation((_data: unknown, opts?: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });

    await act(async () => {
      render(<ExpenseFormScreen navigation={mockNavigation} route={makeRoute()} />);
    });

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('FieldName'), 'Lunch');
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('ButtonAdd'));
    });

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(mockCaptureError).not.toHaveBeenCalled();
  });
});
