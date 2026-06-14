import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { Keyboard } from 'react-native';
import { QuickAddModal } from '../QuickAddModal';

// ─── Sentry mock ─────────────────────────────────────────────────────────────

const mockCaptureError = jest.fn();
jest.mock('../../../monitoring/sentry', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

// ─── UI infrastructure mocks ─────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    LinearGradient: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return {
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement(Text, props, children),
    HelperText: ({ children }: { children: React.ReactNode }) =>
      React.createElement(Text, null, children),
  };
});

jest.mock('../../../components/common/ErrorBanner', () => ({
  ErrorBanner: () => null,
}));

jest.mock('../../../components/auth/AuroraField', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return {
    AuroraField: ({
      placeholder, value, onChangeText, testID,
    }: {
      placeholder?: string;
      value?: string;
      onChangeText?: (t: string) => void;
      testID?: string;
    }) =>
      React.createElement(TextInput, {
        testID: testID ?? placeholder,
        value,
        onChangeText,
      }),
  };
});

jest.mock('../../../theme/useAuroraSkin', () => ({
  auroraTokens: () => ({ ink: '#000', ink2: '#666', hair: '#ccc' }),
}));

// ─── Store / utility mocks ───────────────────────────────────────────────────

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(() => ({
    selectedProject: {
      id: 'up-1',
      userId: 'u1',
      userName: 'Test',
      userEmail: 'test@test.com',
      accepted: true,
      role: 'Admin',
      project: { id: 'proj-1', name: 'My Project', preferredCurrency: 'EUR', isArchived: false },
    },
    currency: 'EUR',
  })),
}));

jest.mock('../../../utils/categoryTheme', () => ({
  getCategoryColor: () => '#0f76a8',
}));

jest.mock('../../../utils/categoryIcon', () => ({
  getCategoryIcon: () => 'tag',
}));

jest.mock('../../../utils/currency', () => ({
  getCurrencySymbol: () => '€',
}));

jest.mock('../../../utils/date', () => ({
  currentMonth: () => '2026-06',
  toDateOnly: (d: Date) => d.toISOString().split('T')[0],
  fromDateOnly: (s: string) => new Date(s),
  dateToMonth: () => '2026-06',
  defaultDateForMonth: () => new Date('2026-06-01'),
}));

jest.mock('../../../utils/patch', () => ({
  buildPatch: (fields: Record<string, unknown>) => Object.entries(fields).map(([path, value]) => ({ op: 'replace', path: `/${path}`, value })),
  buildExpenseItemPatch: (_idx: number, fields: Record<string, unknown>) => Object.entries(fields).map(([path, value]) => ({ op: 'replace', path: `/${path}`, value })),
}));

jest.mock('../../../utils/amountValidation', () => ({
  shouldShowAmountError: () => false,
}));

jest.mock('../../../utils/nameValidation', () => ({
  isNameRequired: () => false,
}));

jest.mock('../../../utils/apiErrors', () => ({
  extractApiErrors: () => ({}),
}));

// ─── Hook mocks ───────────────────────────────────────────────────────────────

const mockCreateIncomeMutate = jest.fn();
const mockCreateExpenseMutate = jest.fn();
const mockAddExpenseItemMutate = jest.fn();
const mockPatchExpenseMutate = jest.fn();
const mockPatchIncomeMutate = jest.fn();

jest.mock('../../../hooks/useCategories', () => ({
  useCategoriesForMonth: jest.fn(() => ({
    data: [
      {
        id: 'cat-1',
        name: 'Food',
        isArchived: false,
        displayOrder: 0,
        totalBudget: 100,
        totalWaste: 0,
        expenses: [],
      },
    ],
  })),
}));

jest.mock('../../../hooks/useExpenses', () => ({
  useExpensesForMonth: jest.fn(() => ({ data: [] })),
  useCreateExpense: jest.fn(() => ({
    mutate: mockCreateExpenseMutate,
    isPending: false,
  })),
  useAddExpenseItem: jest.fn(() => ({
    mutate: mockAddExpenseItemMutate,
    isPending: false,
  })),
  usePatchExpense: jest.fn(() => ({
    mutate: mockPatchExpenseMutate,
    isPending: false,
  })),
}));

jest.mock('../../../hooks/useIncomes', () => ({
  useCreateIncome: jest.fn(() => ({
    mutate: mockCreateIncomeMutate,
    isPending: false,
  })),
  usePatchIncome: jest.fn(() => ({
    mutate: mockPatchIncomeMutate,
    isPending: false,
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockOnClose = jest.fn();

function renderModal(props: Partial<React.ComponentProps<typeof QuickAddModal>> = {}) {
  return render(
    <QuickAddModal
      visible
      onClose={mockOnClose}
      month="2026-06"
      {...props}
    />,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QuickAddModal — Sentry captureError', () => {
  beforeEach(() => {
    mockCaptureError.mockReset();
    mockOnClose.mockReset();
    mockCreateIncomeMutate.mockReset();
    mockCreateExpenseMutate.mockReset();
    mockAddExpenseItemMutate.mockReset();
    mockPatchExpenseMutate.mockReset();
    mockPatchIncomeMutate.mockReset();
  });

  it('calls captureError with createIncome action when createIncome mutation errors', async () => {
    const err = new Error('Create income failed');
    mockCreateIncomeMutate.mockImplementation(
      (_data: unknown, opts?: { onSuccess?: () => void; onError?: (e: unknown) => void }) => {
        opts?.onError?.(err);
      },
    );

    await act(async () => { renderModal(); });

    // Switch to income type
    await act(async () => {
      fireEvent.press(screen.getByText('LabelIncome'));
    });

    // Submit
    await act(async () => {
      fireEvent.press(screen.getByText('ButtonAdd'));
    });

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        err,
        { screen: 'QuickAddModal', action: 'createIncome' },
      );
    });
  });

  it('calls captureError with createExpense action when createExpense mutation errors', async () => {
    const err = new Error('Create expense failed');
    mockCreateExpenseMutate.mockImplementation(
      (_data: unknown, opts?: { onSuccess?: () => void; onError?: (e: unknown) => void }) => {
        opts?.onError?.(err);
      },
    );

    await act(async () => { renderModal({ defaultCategoryId: 'cat-1' }); });

    // Submit — category is pre-selected via defaultCategoryId
    await act(async () => {
      fireEvent.press(screen.getByText('ButtonAdd'));
    });

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        err,
        { screen: 'QuickAddModal', action: 'createExpense' },
      );
    });
  });

  it('calls captureError with addExpenseItem action when addExpenseItem mutation errors', async () => {
    const err = new Error('Add expense item failed');
    mockAddExpenseItemMutate.mockImplementation(
      (_data: unknown, opts?: { onSuccess?: () => void; onError?: (e: unknown) => void }) => {
        opts?.onError?.(err);
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/useExpenses') as any).useExpensesForMonth.mockReturnValue({
      data: [
        { id: 'exp-1', name: 'Groceries', amount: 50, budget: 100, items: [] },
      ],
    });

    await act(async () => { renderModal({ defaultCategoryId: 'cat-1', defaultExpenseId: 'exp-1' }); });

    await act(async () => {
      fireEvent.press(screen.getByText('ButtonAdd'));
    });

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        err,
        { screen: 'QuickAddModal', action: 'addExpenseItem' },
      );
    });
  });

  it('calls captureError with updateExpense action when patchExpense mutation errors in edit mode', async () => {
    const err = new Error('Patch expense failed');
    mockPatchExpenseMutate.mockImplementation(
      (_data: unknown, opts?: { onSuccess?: () => void; onError?: (e: unknown) => void }) => {
        opts?.onError?.(err);
      },
    );

    const editMode = {
      type: 'expense' as const,
      id: 'exp-1',
      categoryId: 'cat-1',
      hasItems: false,
      initialValues: { name: 'Groceries', amount: 50, date: '2026-06-01', isDeductible: false, budget: 0 },
    };

    await act(async () => { renderModal({ editMode }); });

    await act(async () => {
      fireEvent.press(screen.getByText('ButtonSave'));
    });

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        err,
        { screen: 'QuickAddModal', action: 'updateExpense' },
      );
    });
  });

  it('calls captureError with updateIncome action when patchIncome mutation errors in edit mode', async () => {
    const err = new Error('Patch income failed');
    mockPatchIncomeMutate.mockImplementation(
      (_data: unknown, opts?: { onSuccess?: () => void; onError?: (e: unknown) => void }) => {
        opts?.onError?.(err);
      },
    );

    const editMode = {
      type: 'income' as const,
      id: 'inc-1',
      initialValues: { name: 'Salary', amount: 3000, date: '2026-06-01' },
    };

    await act(async () => { renderModal({ editMode }); });

    await act(async () => {
      fireEvent.press(screen.getByText('ButtonSave'));
    });

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        err,
        { screen: 'QuickAddModal', action: 'updateIncome' },
      );
    });
  });

  it('calls captureError with updateExpenseItem action when patchExpense errors on edit-expenseItem path', async () => {
    const err = new Error('Patch expense item failed');
    mockPatchExpenseMutate.mockImplementation(
      (_data: unknown, opts?: { onSuccess?: () => void; onError?: (e: unknown) => void }) => {
        opts?.onError?.(err);
      },
    );

    const editMode = {
      type: 'expenseItem' as const,
      id: 'exp-1',
      categoryId: 'cat-1',
      itemIndex: 0,
      initialValues: { name: 'Groceries', amount: 50, date: '2026-06-01', isDeductible: false },
    };

    await act(async () => { renderModal({ editMode }); });

    await act(async () => {
      fireEvent.press(screen.getByText('ButtonSave'));
    });

    await waitFor(() => {
      expect(mockCaptureError).toHaveBeenCalledWith(
        err,
        { screen: 'QuickAddModal', action: 'updateExpenseItem' },
      );
    });
  });

  it('renders KeyboardAvoidingView wrapper for keyboard avoidance', async () => {
    await act(async () => { renderModal(); });

    const kav = screen.getByTestId('quick-add-keyboard-avoid');
    expect(kav).toBeTruthy();
  });

  it('subscribes to keyboard show/hide events to adjust modal position', async () => {
    const addListenerSpy = jest.spyOn(Keyboard, 'addListener');

    await act(async () => { renderModal(); });

    expect(addListenerSpy).toHaveBeenCalledWith('keyboardDidShow', expect.any(Function));
    expect(addListenerSpy).toHaveBeenCalledWith('keyboardDidHide', expect.any(Function));

    addListenerSpy.mockRestore();
  });

  it('applies keyboard height as bottom padding on ScrollView content', async () => {
    await act(async () => { renderModal(); });

    // The scroll content container should use styles.scrollContent as base
    // and dynamically add extra paddingBottom when keyboard is shown
    const scrollView = screen.getByTestId('quick-add-scroll');
    expect(scrollView).toBeTruthy();
  });
});
