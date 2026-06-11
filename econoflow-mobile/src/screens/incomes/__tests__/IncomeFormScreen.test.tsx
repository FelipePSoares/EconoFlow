import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { IncomeFormScreen } from '../IncomeFormScreen';

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
  const { Text, TextInput, TouchableOpacity } = require('react-native');
  return {
    Button: ({
      children,
      onPress,
      loading: _loading,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      loading?: boolean;
    }) =>
      React.createElement(
        TouchableOpacity,
        { onPress, testID: String(children) },
        React.createElement(Text, null, children),
      ),
    HelperText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
    Text: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
    TextInput: ({
      label,
      value,
      onChangeText,
    }: {
      label?: string;
      value?: string;
      onChangeText?: (t: string) => void;
    }) =>
      React.createElement(TextInput, {
        testID: label,
        value,
        onChangeText,
      }),
  };
});

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

// ─── Store / hook mocks ───────────────────────────────────────────────────────

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(() => ({
    selectedProject: { project: { id: 'proj-1' }, role: 'Manager' },
    currency: 'EUR',
  })),
}));

const mockCreateMutate = jest.fn();
const mockPatchMutate = jest.fn();

jest.mock('../../../hooks/useIncomes', () => ({
  useCreateIncome: jest.fn(() => ({
    mutate: mockCreateMutate,
    isPending: false,
  })),
  usePatchIncome: jest.fn(() => ({
    mutate: mockPatchMutate,
    isPending: false,
  })),
}));

jest.mock('../../../utils/date', () => ({
  toDateOnly: jest.fn(() => '2024-01-01'),
  fromDateOnly: jest.fn(() => new Date('2024-01-01')),
  currentMonth: jest.fn(() => '2024-01'),
}));

jest.mock('../../../utils/patch', () => ({
  buildPatch: jest.fn((obj: Record<string, unknown>) => obj),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockGoBack = jest.fn();
const mockNavigation = {
  goBack: mockGoBack,
} as unknown as React.ComponentProps<typeof IncomeFormScreen>['navigation'];

const makeRoute = (overrides = {}) =>
  ({
    key: 'IncomeForm',
    name: 'IncomeForm' as const,
    params: {
      month: '2024-01',
      ...overrides,
    },
  } as unknown as React.ComponentProps<typeof IncomeFormScreen>['route']);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('IncomeFormScreen — captureError', () => {
  beforeEach(() => {
    mockCreateMutate.mockReset();
    mockPatchMutate.mockReset();
    mockGoBack.mockReset();
    mockCaptureError.mockReset();
  });

  it('calls captureError with createIncome action when createIncome mutation fails', async () => {
    const error = new Error('create failed');
    mockCreateMutate.mockImplementation((_data: unknown, opts?: { onError?: (e: unknown) => void }) => {
      opts?.onError?.(error);
    });

    await act(async () => {
      render(<IncomeFormScreen navigation={mockNavigation} route={makeRoute()} />);
    });

    // Fill required name field so react-hook-form validation passes
    await act(async () => {
      fireEvent.changeText(screen.getByTestId('FieldName'), 'Salary');
    });

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('FieldAmount'), '1000');
    });

    // submit the form
    await act(async () => {
      fireEvent.press(screen.getByTestId('ButtonAdd'));
    });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({ screen: 'IncomeFormScreen', action: 'createIncome' }),
      ),
    );
  });

  it('calls captureError with updateIncome action when patchIncome mutation fails', async () => {
    const error = new Error('patch failed');
    mockPatchMutate.mockImplementation((_data: unknown, opts?: { onError?: (e: unknown) => void }) => {
      opts?.onError?.(error);
    });

    await act(async () => {
      render(
        <IncomeFormScreen
          navigation={mockNavigation}
          route={makeRoute({
            incomeId: 'inc-1',
            initialValues: { name: 'Salary', amount: 1000, date: '2024-01-01' },
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
        expect.objectContaining({ screen: 'IncomeFormScreen', action: 'updateIncome' }),
      ),
    );
  });

  it('does not call captureError when createIncome succeeds', async () => {
    mockCreateMutate.mockImplementation((_data: unknown, opts?: { onSuccess?: () => void }) => {
      opts?.onSuccess?.();
    });

    await act(async () => {
      render(<IncomeFormScreen navigation={mockNavigation} route={makeRoute()} />);
    });

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('FieldName'), 'Salary');
    });

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('FieldAmount'), '1000');
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('ButtonAdd'));
    });

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(mockCaptureError).not.toHaveBeenCalled();
  });
});
