import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PlanFormScreen } from '../PlanFormScreen';
import type { Plan } from '../../../api/types';

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

jest.mock('../../../components/common/GlassCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    GlassCard: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  };
});

jest.mock('../../../components/common/ErrorBanner', () => ({
  ErrorBanner: () => null,
}));

jest.mock('../../../components/auth/AuroraField', () => {
  const React = require('react');
  const { TextInput } = require('react-native');
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    AuroraField: ({ placeholder, value, onChangeText }: any) =>
      React.createElement(TextInput, { testID: `field-${placeholder}`, value, onChangeText }),
  };
});

jest.mock('../../../components/auth/AuroraPrimaryButton', () => {
  const React = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return {
    AuroraPrimaryButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(
        TouchableOpacity,
        { onPress, testID: `btn-${label}` },
        React.createElement(Text, null, label),
      ),
  };
});

// ─── API mock (prevents client.ts / i18n init side-effects) ──────────────────

jest.mock('../../../api/plans.api', () => ({
  patchPlan: jest.fn(),
  createPlan: jest.fn(),
}));

// ─── Store / hook mocks ───────────────────────────────────────────────────────

jest.mock('../../../store/projectStore', () => ({
  useProjectStore: jest.fn(),
}));

const EXISTING_EMERGENCY_PLAN: Plan = {
  id: 'plan-e',
  projectId: 'proj-1',
  type: 'EmergencyReserve',
  name: 'Emergency',
  targetAmount: 5000,
  currentBalance: 1000,
  remaining: 4000,
  progress: 0.2,
  isArchived: false,
};

jest.mock('../../../hooks/usePlans', () => ({
  usePlans: jest.fn(() => ({ data: [] })),
  useCreatePlan: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
  usePatchPlan: jest.fn(() => ({ mutate: jest.fn(), isPending: false })),
}));

// ─── Navigation mock ──────────────────────────────────────────────────────────

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as unknown as React.ComponentProps<typeof PlanFormScreen>['navigation'];

function makeCreateRoute(extraParams = {}) {
  return {
    params: { ...extraParams },
  } as unknown as React.ComponentProps<typeof PlanFormScreen>['route'];
}

function makeEditRoute(planId: string) {
  return {
    params: {
      planId,
      initialValues: { type: 'Saving' as const, name: 'Existing Plan', targetAmount: 1000 },
    },
  } as unknown as React.ComponentProps<typeof PlanFormScreen>['route'];
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PlanFormScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGoBack.mockReset();
    mockCaptureError.mockReset();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../store/projectStore') as any).useProjectStore.mockReturnValue({
      selectedProject: {
        id: 'up-1',
        role: 'Manager',
        project: { id: 'proj-1', name: 'Test', preferredCurrency: 'EUR', isArchived: false },
      },
      currency: 'EUR',
    });
    // reset hooks to defaults
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePlans.mockReturnValue({ data: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).useCreatePlan.mockReturnValue({ mutate: jest.fn(), isPending: false });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePatchPlan.mockReturnValue({ mutate: jest.fn(), isPending: false });
  });

  it('shows CreatePlan title in create mode', async () => {
    await act(async () => {
      render(<PlanFormScreen navigation={mockNavigation} route={makeCreateRoute()} />);
    });
    expect(screen.getByText('CreatePlan')).toBeTruthy();
  });

  it('shows EditPlan title in edit mode', async () => {
    await act(async () => {
      render(<PlanFormScreen navigation={mockNavigation} route={makeEditRoute('plan-1')} />);
    });
    expect(screen.getByText('EditPlan')).toBeTruthy();
  });

  it('shows both Savings and EmergencyReserve options when no EmergencyReserve plan exists', async () => {
    await act(async () => {
      render(<PlanFormScreen navigation={mockNavigation} route={makeCreateRoute()} />);
    });
    expect(screen.getByText('PlanTypeSaving')).toBeTruthy();
    expect(screen.getByText('PlanTypeEmergencyReserve')).toBeTruthy();
  });

  it('hides EmergencyReserve option when one already exists', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePlans.mockReturnValue({
      data: [EXISTING_EMERGENCY_PLAN],
    });

    await act(async () => {
      render(<PlanFormScreen navigation={mockNavigation} route={makeCreateRoute()} />);
    });
    // EmergencyReserve option should not be shown
    expect(screen.queryByText('PlanTypeEmergencyReserve')).toBeNull();
  });

  it('renders save button', async () => {
    await act(async () => {
      render(<PlanFormScreen navigation={mockNavigation} route={makeCreateRoute()} />);
    });
    expect(screen.getByTestId('btn-ButtonSave')).toBeTruthy();
  });

  it('calls usePatchPlan.mutate with patch ops on save in edit mode', async () => {
    const mockMutate = jest.fn().mockImplementation((_ops, { onSuccess }) => onSuccess());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePatchPlan.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    await act(async () => {
      render(<PlanFormScreen navigation={mockNavigation} route={makeEditRoute('plan-1')} />);
    });

    // Fields are pre-filled by initialValues; just press Save
    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-ButtonSave'));
    });

    expect(mockMutate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ path: '/name' })]),
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    );
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('calls captureError when createPlan mutation fails', async () => {
    const createError = new Error('create failed');
    const mockMutate = jest.fn().mockImplementation((_data, { onError }) => onError(createError));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).useCreatePlan.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    await act(async () => {
      render(<PlanFormScreen navigation={mockNavigation} route={makeCreateRoute()} />);
    });

    await act(async () => {
      fireEvent.changeText(screen.getByTestId('field-PlanName'), 'Test Plan');
      fireEvent.changeText(screen.getByTestId('field-0'), '500');
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-ButtonSave'));
    });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ screen: 'PlanFormScreen', action: 'createPlan' }),
      ),
    );
  });

  it('calls captureError when patchPlan mutation fails', async () => {
    const patchError = new Error('patch failed');
    const mockMutate = jest.fn().mockImplementation((_ops, { onError }) => onError(patchError));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (jest.requireMock('../../../hooks/usePlans') as any).usePatchPlan.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });

    await act(async () => {
      render(<PlanFormScreen navigation={mockNavigation} route={makeEditRoute('plan-1')} />);
    });

    await act(async () => {
      fireEvent.press(screen.getByTestId('btn-ButtonSave'));
    });

    await waitFor(() =>
      expect(mockCaptureError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({ screen: 'PlanFormScreen', action: 'updatePlan' }),
      ),
    );
  });
});
