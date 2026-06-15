import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';
import { PinSetupScreen } from '../PinSetupScreen';

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

const mockSetPin = jest.fn();
jest.mock('../../../store/pinStore', () => ({
  usePinStore: jest.fn((selector?: (s: { hasPin: boolean; setPin: typeof mockSetPin }) => unknown) => {
    const state = { hasPin: false, setPin: mockSetPin };
    return selector ? selector(state) : state;
  }),
}));

const mockReset = jest.fn();
const mockNavigation = { reset: mockReset } as unknown as React.ComponentProps<typeof PinSetupScreen>['navigation'];
const mockRoute = {} as unknown as React.ComponentProps<typeof PinSetupScreen>['route'];

async function tap(d: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(`pin-key-${d}`));
  });
}

describe('PinSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders create PIN title', async () => {
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    expect(screen.getByText('PinCreateTitle')).toBeTruthy();
  });

  it('renders numeric keypad', async () => {
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    expect(screen.getByTestId('pin-key-1')).toBeTruthy();
  });

  it('transitions to confirm step after entering PIN', async () => {
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3'); await tap('4');
    await waitFor(() => expect(screen.getByText('PinConfirmTitle')).toBeTruthy());
  });

  it('calls setPin and navigates to BiometricEnroll on matching confirmation', async () => {
    mockSetPin.mockResolvedValue(undefined);
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3'); await tap('4');
    await waitFor(() => expect(screen.getByText('PinConfirmTitle')).toBeTruthy());
    await tap('1'); await tap('2'); await tap('3'); await tap('4');
    await waitFor(() => {
      expect(mockSetPin).toHaveBeenCalledWith('1234');
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'BiometricEnroll' }] });
    });
  });
});
