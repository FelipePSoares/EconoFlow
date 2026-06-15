import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';
import { PinEntryScreen } from '../PinEntryScreen';

afterEach(cleanup);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

jest.mock('../../../theme/useAuroraSkin', () => ({
  useAuroraSkin: () => ({ dark: false, ink: '#000', ink2: '#666', hair: '#ccc' }),
}));

jest.mock('@expo/vector-icons', () => ({ MaterialCommunityIcons: 'MaterialCommunityIcons' }));

jest.mock('expo-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { LinearGradient: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children) };
});

jest.mock('../../../components/common/GlassCard', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { GlassCard: ({ children, ...props }: { children: React.ReactNode }) => React.createElement(View, props, children) };
});

jest.mock('../../../components/common/GlassScreen', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { GlassScreen: ({ children }: { children: React.ReactNode }) => React.createElement(View, null, children) };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const { Text: RNText } = require('react-native');
  return { Text: ({ children, ...props }: Record<string, unknown>) => React.createElement(RNText, props, children) };
});

const mockVerifyPin = jest.fn();
const mockClearPin = jest.fn();
jest.mock('../../../store/pinStore', () => ({
  usePinStore: jest.fn((selector?: (s: { hasPin: boolean; verifyPin: typeof mockVerifyPin; clearPin: typeof mockClearPin }) => unknown) => {
    const state = { hasPin: true, verifyPin: mockVerifyPin, clearPin: mockClearPin };
    return selector ? selector(state) : state;
  }),
}));

const mockSetUnlocked = jest.fn();
jest.mock('../../../store/lockStore', () => ({
  useLockStore: jest.fn((selector?: (s: { setUnlocked: typeof mockSetUnlocked }) => unknown) => {
    const state = { setUnlocked: mockSetUnlocked };
    return selector ? selector(state) : state;
  }),
}));

const mockClearAuth = jest.fn();
jest.mock('../../../store/authStore', () => ({
  useAuthStore: jest.fn((selector?: (s: { clearAuth: typeof mockClearAuth }) => unknown) => {
    const state = { clearAuth: mockClearAuth };
    return selector ? selector(state) : state;
  }),
}));

const mockClearBiometric = jest.fn();
jest.mock('../../../store/biometricStore', () => ({
  useBiometricStore: jest.fn((selector?: (s: { clearBiometric: typeof mockClearBiometric }) => unknown) => {
    const state = { clearBiometric: mockClearBiometric };
    return selector ? selector(state) : state;
  }),
}));

const mockReset = jest.fn();
const mockNavigation = { reset: mockReset } as unknown as React.ComponentProps<typeof PinEntryScreen>['navigation'];
const mockRoute = {} as unknown as React.ComponentProps<typeof PinEntryScreen>['route'];

async function tap(d: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(`pin-key-${d}`));
  });
}

describe('PinEntryScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders PIN entry title', async () => {
    await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });
    expect(screen.getByText('PinEntryTitle')).toBeTruthy();
  });

  it('renders numeric keypad', async () => {
    await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });
    expect(screen.getByTestId('pin-key-1')).toBeTruthy();
  });

  it('renders forgot PIN button', async () => {
    await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });
    expect(screen.getByTestId('pin-forgot')).toBeTruthy();
  });

  it('unlocks and navigates on correct PIN', async () => {
    mockVerifyPin.mockResolvedValue(true);
    await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3'); await tap('4');
    await waitFor(() => expect(mockVerifyPin).toHaveBeenCalledWith('1234'));
    await waitFor(() => {
      expect(mockSetUnlocked).toHaveBeenCalled();
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'BiometricGate' }] });
    });
  });

  it('shows error on wrong PIN', async () => {
    mockVerifyPin.mockResolvedValue(false);
    await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3'); await tap('4');
    await waitFor(() => {
      expect(screen.getAllByText('PinAttemptsRemaining').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('signs out on forgot PIN press', async () => {
    await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });
    await act(async () => {
      fireEvent.press(screen.getByTestId('pin-forgot'));
    });
    expect(mockClearBiometric).toHaveBeenCalled();
    expect(mockClearPin).toHaveBeenCalled();
    expect(mockClearAuth).toHaveBeenCalled();
    expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Auth' }] });
  });
});
