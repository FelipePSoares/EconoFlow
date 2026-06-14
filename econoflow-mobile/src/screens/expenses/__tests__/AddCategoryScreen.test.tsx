import React from 'react';
import { act, render, fireEvent, screen } from '@testing-library/react-native';
import { AddCategoryScreen } from '../AddCategoryScreen';

// ─── Sentry mock ──────────────────────────────────────────────────────────────

const mockCaptureError = jest.fn();
jest.mock('../../../monitoring/sentry', () => ({
  captureError: (...args: unknown[]) => mockCaptureError(...args),
}));

// ─── UI infrastructure mocks ──────────────────────────────────────────────────

jest.mock('@expo/vector-icons', () => ({
  MaterialCommunityIcons: 'MaterialCommunityIcons',
  Ionicons: 'Ionicons',
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
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

jest.mock('../../../components/common/GlassScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassScreen: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('../../../components/common/ErrorBanner', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    ErrorBanner: ({ message }: { message: string }) =>
      React.createElement(View, null, React.createElement(Text, null, message)),
  };
});

const mockCreateMutate = jest.fn();
jest.mock('../../../hooks/useCategories', () => ({
  useCreateCategory: jest.fn(() => ({ mutate: mockCreateMutate, isPending: false })),
}));

jest.mock('../../../hooks/useSmartSetup', () => ({
  useDefaultCategories: jest.fn(() => ({
    data: [
      { name: 'Fixed Costs', percentage: 30 },
      { name: 'Comfort', percentage: 20 },
      { name: 'Enjoyment', percentage: 20 },
      { name: 'Financial Freedom', percentage: 25 },
      { name: 'Self-Improvement', percentage: 5 },
    ],
    isLoading: false,
  })),
}));

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(() => ({
    selectedProject: { project: { id: 'proj-1' }, role: 'Manager' },
    currency: 'EUR',
  })),
}));

jest.mock('@react-navigation/native', () => ({
  useIsFocused: jest.fn(() => true),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  setOptions: jest.fn(),
} as unknown as React.ComponentProps<typeof AddCategoryScreen>['navigation'];

const mockRoute = {
  key: 'AddCategory',
  name: 'AddCategory' as const,
  params: { month: '2026-01' },
} as unknown as React.ComponentProps<typeof AddCategoryScreen>['route'];

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AddCategoryScreen', () => {
  beforeEach(() => {
    mockCreateMutate.mockReset();
    mockGoBack.mockReset();
    mockNavigate.mockReset();
  });

  it('renders the category name input field', async () => {
    await act(async () => {
      render(<AddCategoryScreen navigation={mockNavigation} route={mockRoute} />);
    });

    expect(screen.getByPlaceholderText('FieldCategoryName')).toBeTruthy();
  });

  it('shows required validation error when name is empty and submit is pressed', async () => {
    await act(async () => {
      render(<AddCategoryScreen navigation={mockNavigation} route={mockRoute} />);
    });

    const submitButton = screen.getByText('ButtonCreate');
    await act(async () => {
      fireEvent.press(submitButton);
    });

    expect(screen.getByText('RequiredField')).toBeTruthy();
  });

  it('shows max length error when name exceeds 100 characters', async () => {
    await act(async () => {
      render(<AddCategoryScreen navigation={mockNavigation} route={mockRoute} />);
    });

    const input = screen.getByPlaceholderText('FieldCategoryName');
    await act(async () => {
      fireEvent.changeText(input, 'A'.repeat(101));
    });

    const submitButton = screen.getByText('ButtonCreate');
    await act(async () => {
      fireEvent.press(submitButton);
    });

    expect(screen.getByText('PropertyMaxLength')).toBeTruthy();
  });

  it('calls createCategory mutation with the name on valid submit', async () => {
    await act(async () => {
      render(<AddCategoryScreen navigation={mockNavigation} route={mockRoute} />);
    });

    const input = screen.getByPlaceholderText('FieldCategoryName');
    await act(async () => {
      fireEvent.changeText(input, 'New Category');
    });

    const submitButton = screen.getByText('ButtonCreate');
    await act(async () => {
      fireEvent.press(submitButton);
    });

    expect(mockCreateMutate).toHaveBeenCalledWith(
      { name: 'New Category' },
      expect.any(Object),
    );
  });

  it('navigates back on successful category creation', async () => {
    mockCreateMutate.mockImplementation(
      (_data: unknown, opts?: { onSuccess?: () => void }) => {
        opts?.onSuccess?.();
      },
    );

    await act(async () => {
      render(<AddCategoryScreen navigation={mockNavigation} route={mockRoute} />);
    });

    const input = screen.getByPlaceholderText('FieldCategoryName');
    await act(async () => {
      fireEvent.changeText(input, 'New Category');
    });

    const submitButton = screen.getByText('ButtonCreate');
    await act(async () => {
      fireEvent.press(submitButton);
    });

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('shows error banner on mutation failure', async () => {
    mockCreateMutate.mockImplementation(
      (_data: unknown, opts?: { onError?: (e: Error) => void }) => {
        opts?.onError?.(new Error('creation failed'));
      },
    );

    await act(async () => {
      render(<AddCategoryScreen navigation={mockNavigation} route={mockRoute} />);
    });

    const input = screen.getByPlaceholderText('FieldCategoryName');
    await act(async () => {
      fireEvent.changeText(input, 'New Category');
    });

    const submitButton = screen.getByText('ButtonCreate');
    await act(async () => {
      fireEvent.press(submitButton);
    });

    expect(screen.getByText('ErrorGeneric')).toBeTruthy();
  });

  it('renders the back button', async () => {
    await act(async () => {
      render(<AddCategoryScreen navigation={mockNavigation} route={mockRoute} />);
    });

    expect(screen.getByTestId('add-category-back-btn')).toBeTruthy();
  });

  it('renders the "Create Category" title', async () => {
    await act(async () => {
      render(<AddCategoryScreen navigation={mockNavigation} route={mockRoute} />);
    });

    expect(screen.getByText('CreateCategory')).toBeTruthy();
  });

  it('does not call createCategory mutation when form is invalid', async () => {
    await act(async () => {
      render(<AddCategoryScreen navigation={mockNavigation} route={mockRoute} />);
    });

    const submitButton = screen.getByText('ButtonCreate');
    await act(async () => {
      fireEvent.press(submitButton);
    });

    expect(mockCreateMutate).not.toHaveBeenCalled();
  });
});
