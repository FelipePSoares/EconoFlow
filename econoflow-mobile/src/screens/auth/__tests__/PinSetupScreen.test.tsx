import React from 'react';
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react-native';
import { PinSetupScreen } from '../PinSetupScreen';

// A test that ends on the confirm step leaves a pending setPin/navigation promise behind;
// without unmounting it, the next test renders into a tree that is being torn down.
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

const mockSetPin = jest.fn();
jest.mock('../../../store/pinStore', () => ({
  // The screen imports the length bounds from the store module, so the mock has to
  // provide them too — `undefined` would make the keypad's limit comparison false.
  PIN_LENGTH_MIN: 4,
  PIN_LENGTH_MAX: 6,
  usePinStore: jest.fn((selector?: (s: { hasPin: boolean; setPin: typeof mockSetPin }) => unknown) => {
    const state = { hasPin: false, setPin: mockSetPin };
    return selector ? selector(state) : state;
  }),
}));

const mockReset = jest.fn();
const mockReplace = jest.fn();
const mockNavigation = {
  reset: mockReset,
  replace: mockReplace,
  // The continuation asks whether this screen is still the one in front before it moves
  // on: a dispatch from a settled promise must not race the screen it replaces (#1116).
  isFocused: () => true,
} as unknown as React.ComponentProps<typeof PinSetupScreen>['navigation'];
const mockRoute = {} as unknown as React.ComponentProps<typeof PinSetupScreen>['route'];

async function tap(d: string) {
  await act(async () => {
    fireEvent.press(screen.getByTestId(`pin-key-${d}`));
  });
}

describe('PinSetupScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // A stored answer that was held back by one case must not leak into the next: the
    // screen waits for it before it chooses a screen.
    const { useBiometricStore } = jest.requireActual('../../../store/biometricStore');
    useBiometricStore.persist.hasHydrated = () => true;
  });

  it('renders create PIN title', async () => {
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    expect(screen.getByText('PinCreateTitle')).toBeTruthy();
  });

  it('renders numeric keypad', async () => {
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    expect(screen.getByTestId('pin-key-1')).toBeTruthy();
  });

  // The reported bug (#1052): the confirm step started as soon as four digits were typed,
  // so a 5- or 6-digit PIN could never be created.
  it('lets the user keep typing past four digits', async () => {
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3'); await tap('4'); await tap('5');

    expect(screen.getByText('PinCreateTitle')).toBeTruthy();
    expect(screen.queryByText('PinConfirmTitle')).toBeNull();
  });

  it('does not go to confirm until the user continues', async () => {
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3'); await tap('4');

    expect(screen.queryByText('PinConfirmTitle')).toBeNull();
    expect(screen.getByTestId('pin-create-continue')).toBeTruthy();
  });

  it('cannot continue with fewer than four digits', async () => {
    mockSetPin.mockResolvedValue(undefined);
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3');

    await act(async () => {
      fireEvent.press(screen.getByTestId('pin-create-continue'));
    });
    // Still on the create step: a fourth digit is needed before confirm appears.
    expect(screen.queryByTestId('pin-create-continue')).toBeTruthy();

    await tap('4');
    await act(async () => {
      fireEvent.press(screen.getByTestId('pin-create-continue'));
    });
    expect(screen.queryByTestId('pin-create-continue')).toBeNull();
  });

  it('does not accept a seventh digit', async () => {
    mockSetPin.mockResolvedValue(undefined);
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    for (const d of ['1', '2', '3', '4', '5', '6', '7']) await tap(d);
    await act(async () => {
      fireEvent.press(screen.getByTestId('pin-create-continue'));
    });
    expect(screen.queryByTestId('pin-create-continue')).toBeNull();

    // A 7th digit was ignored, so re-entering the six digits confirms the PIN.
    for (const d of ['1', '2', '3', '4', '5', '6']) await tap(d);
    await waitFor(() => expect(mockSetPin).toHaveBeenCalledWith('123456'));
  });

  it('calls setPin and navigates to BiometricEnroll on matching confirmation', async () => {
    mockSetPin.mockResolvedValue(undefined);
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3'); await tap('4');
    await act(async () => {
      fireEvent.press(screen.getByTestId('pin-create-continue'));
    });
    await waitFor(() => expect(screen.getByText('PinConfirmTitle')).toBeTruthy());
    await tap('1'); await tap('2'); await tap('3'); await tap('4');
    await waitFor(() => {
      expect(mockSetPin).toHaveBeenCalledWith('1234');
      expect(mockReplace).toHaveBeenCalledWith('BiometricEnroll');
    });
  });

  // The reported bug (#1052): confirming the same 4 digits did not continue, because the
  // confirm step waited for six.
  it('confirms as soon as the same number of digits is typed again', async () => {
    mockSetPin.mockResolvedValue(undefined);
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3'); await tap('4');
    await act(async () => {
      fireEvent.press(screen.getByTestId('pin-create-continue'));
    });
    await waitFor(() => expect(screen.getByText('PinConfirmTitle')).toBeTruthy());

    await tap('1'); await tap('2'); await tap('3'); await tap('4');

    await waitFor(() => expect(mockSetPin).toHaveBeenCalledWith('1234'));
  });

  it('confirms a six-digit PIN after six digits are typed again', async () => {
    mockSetPin.mockResolvedValue(undefined);
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    for (const d of ['1', '2', '3', '4', '5', '6']) await tap(d);
    await act(async () => {
      fireEvent.press(screen.getByTestId('pin-create-continue'));
    });
    await waitFor(() => expect(screen.getByText('PinConfirmTitle')).toBeTruthy());

    for (const d of ['1', '2', '3', '4', '5', '6']) await tap(d);

    await waitFor(() => expect(mockSetPin).toHaveBeenCalledWith('123456'));
  });

  it('confirms a five-digit PIN after five digits are typed again', async () => {
    mockSetPin.mockResolvedValue(undefined);
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    for (const d of ['1', '2', '3', '4', '5']) await tap(d);
    await act(async () => {
      fireEvent.press(screen.getByTestId('pin-create-continue'));
    });
    await waitFor(() => expect(screen.getByText('PinConfirmTitle')).toBeTruthy());

    for (const d of ['1', '2', '3', '4', '5']) await tap(d);

    await waitFor(() => expect(mockSetPin).toHaveBeenCalledWith('12345'));
  });

  it('starts over with an error when the confirmation differs', async () => {
    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3'); await tap('4');
    await act(async () => {
      fireEvent.press(screen.getByTestId('pin-create-continue'));
    });
    await waitFor(() => expect(screen.getByText('PinConfirmTitle')).toBeTruthy());

    await tap('9'); await tap('9'); await tap('9'); await tap('9');

    await waitFor(() => expect(screen.getByText('PinMismatch')).toBeTruthy());
    expect(mockSetPin).not.toHaveBeenCalled();
    expect(screen.getByText('PinCreateTitle')).toBeTruthy();
  });

  it('does not offer biometrics to a user who already declined them', async () => {
    // Whatever lands here, the declined offer must not come back: the user enables
    // biometrics from the settings when they want it.
    const { usePinStore } = jest.requireActual('../../../store/pinStore');
    usePinStore.setState({ pinHash: null, hasPin: false, hydrated: true });
    const { useBiometricStore } = jest.requireActual('../../../store/biometricStore');
    useBiometricStore.setState({ biometricPromptSkipped: true, hydrated: true });
    mockSetPin.mockResolvedValue(undefined);

    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3'); await tap('4');
    await act(async () => {
      fireEvent.press(screen.getByTestId('pin-create-continue'));
    });
    await waitFor(() => expect(screen.getByText('PinConfirmTitle')).toBeTruthy());
    await tap('1'); await tap('2'); await tap('3'); await tap('4');

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('BiometricGate');
    });
    expect(mockReplace).not.toHaveBeenCalledWith('BiometricEnroll');
  });

  // #1052: biometrics stay optional. The gate sends a user without a PIN here first, and
  // dropping them into the enrollment offer used to trap them in a loop when they had
  // already declined it.
  it('continues the unlock flow instead of re-offering biometrics once declined', async () => {
    const { useBiometricStore } = jest.requireActual('../../../store/biometricStore');
    useBiometricStore.setState({ biometricPromptSkipped: true, hydrated: true });
    mockSetPin.mockResolvedValue(undefined);

    await act(async () => { render(<PinSetupScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3'); await tap('4');
    await act(async () => {
      fireEvent.press(screen.getByTestId('pin-create-continue'));
    });
    await waitFor(() => expect(screen.getByText('PinConfirmTitle')).toBeTruthy());
    await tap('1'); await tap('2'); await tap('3'); await tap('4');

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('BiometricGate');
    });
    expect(mockReplace).not.toHaveBeenCalledWith('BiometricEnroll');
  });
});


