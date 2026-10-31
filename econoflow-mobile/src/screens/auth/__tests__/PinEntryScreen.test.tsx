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
// The stored number of digits; `null` for a PIN saved before the length was recorded.
let mockPinLength: number | null = null;
jest.mock('../../../store/pinStore', () => ({
  // Imported by the screen for the input bounds; `undefined` would disable them.
  PIN_LENGTH_MIN: 4,
  PIN_LENGTH_MAX: 6,
  usePinStore: jest.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = {
      hasPin: true,
      pinLength: mockPinLength,
      verifyPin: mockVerifyPin,
      clearPin: mockClearPin,
    };
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
const mockBiometricState = { biometricEnabled: false };
const mockBiometricEnabled = () => { mockBiometricState.biometricEnabled = true; };
const mockBiometricDisabled = () => { mockBiometricState.biometricEnabled = false; };
jest.mock('../../../store/biometricStore', () => ({
  useBiometricStore: jest.fn((selector?: (s: Record<string, unknown>) => unknown) => {
    const state = { clearBiometric: mockClearBiometric, biometricEnabled: mockBiometricState.biometricEnabled };
    return selector ? selector(state) : state;
  }),
}));

// The "try biometrics again" path shares the unlock hook, so the sensor is mocked here.
const mockAuthenticateAsync = jest.fn();
const mockCancelBiometric = jest.fn();
const resetCancelMock = () => { mockCancelBiometric.mockReset(); };
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn().mockResolvedValue(true),
  isEnrolledAsync: jest.fn().mockResolvedValue(true),
  authenticateAsync: (...args: unknown[]) => mockAuthenticateAsync(...args),
  cancelAuthenticate: () => mockCancelBiometric(),
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
    mockPinLength = null;
  });

  // The reported bug (#1052): entering the 4 digits of a freshly created PIN did nothing,
  // because the screen always waited for six.
  describe('with a known PIN length', () => {
    it('verifies a four-digit PIN as soon as the fourth digit is typed', async () => {
      mockPinLength = 4;
      mockVerifyPin.mockResolvedValue(true);
      await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });

      await tap('1'); await tap('2'); await tap('3'); await tap('4');

      await waitFor(() => expect(mockVerifyPin).toHaveBeenCalledWith('1234'));
      await waitFor(() => expect(mockSetUnlocked).toHaveBeenCalled());
    });

    it('verifies a five-digit PIN after five digits', async () => {
      mockPinLength = 5;
      mockVerifyPin.mockResolvedValue(true);
      await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });

      for (const d of ['1', '2', '3', '4', '5']) await tap(d);

      await waitFor(() => expect(mockVerifyPin).toHaveBeenCalledWith('12345'));
    });

    it('verifies a six-digit PIN after six digits and not before', async () => {
      mockPinLength = 6;
      mockVerifyPin.mockResolvedValue(true);
      await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });

      for (const d of ['1', '2', '3', '4', '5']) await tap(d);
      expect(mockVerifyPin).not.toHaveBeenCalled();

      await tap('6');

      await waitFor(() => expect(mockVerifyPin).toHaveBeenCalledWith('123456'));
    });

    it('never accepts a seventh digit', async () => {
      mockPinLength = 6;
      mockVerifyPin.mockResolvedValue(false);
      await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });

      for (const d of ['1', '2', '3', '4', '5', '6', '7']) await tap(d);

      await waitFor(() => expect(mockVerifyPin).toHaveBeenCalledWith('123456'));
    });
  });

  // #1052: the PIN is the fallback when the sensor gave up. A user whose fingerprint
  // suddenly works again must not be stuck on the keypad.
  describe('when the PIN is the fallback for biometrics', () => {
    beforeEach(() => {
      mockPinLength = 4;
      resetCancelMock();
      mockBiometricEnabled();
    });

    it('does not prompt for the sensor on top of the keypad', async () => {
      await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });

      // The fallback screen never opens a prompt of its own: the PIN is what is being asked.
      expect(mockAuthenticateAsync).not.toHaveBeenCalled();
      expect(screen.getByTestId('pin-key-1')).toBeTruthy();
    });

    it('offers a button that tries biometrics again', async () => {
      await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });

      expect(screen.getByTestId('pin-use-biometric')).toBeTruthy();
    });

    it('unlocks when the retried sensor succeeds', async () => {
      mockAuthenticateAsync.mockResolvedValue({ success: true });
      await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });

      await act(async () => {
        fireEvent.press(screen.getByTestId('pin-use-biometric'));
      });

      await waitFor(() => {
        expect(mockAuthenticateAsync).toHaveBeenCalled();
        expect(mockSetUnlocked).toHaveBeenCalled();
        expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
      });
    });

    it('stays on the keypad when the sensor fails again', async () => {
      mockAuthenticateAsync.mockResolvedValue({ success: false, error: 'authentication_failed' });
      await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });

      await act(async () => {
        fireEvent.press(screen.getByTestId('pin-use-biometric'));
      });

      await waitFor(() => expect(mockAuthenticateAsync).toHaveBeenCalled());
      expect(mockSetUnlocked).not.toHaveBeenCalled();
      expect(screen.getByTestId('pin-use-biometric')).toBeTruthy();
    });

    it('hides the button when biometrics are not enabled', async () => {
      mockBiometricDisabled();
      await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });

      expect(screen.queryByTestId('pin-use-biometric')).toBeNull();
    });
  });

  describe('with a PIN saved before its length was recorded', () => {
    it('verifies once the typed PIN hashes to the stored one', async () => {
      mockPinLength = null;
      mockVerifyPin.mockImplementation(async (pin: string) => pin === '123456');
      await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });

      for (const d of ['1', '2', '3', '4', '5']) await tap(d);
      expect(mockSetUnlocked).not.toHaveBeenCalled();

      await tap('6');

      await waitFor(() => expect(mockSetUnlocked).toHaveBeenCalled());
    });

    it('counts a wrong attempt only after six digits were tried', async () => {
      mockPinLength = null;
      mockVerifyPin.mockResolvedValue(false);
      await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });

      await tap('1'); await tap('2'); await tap('3'); await tap('4');

      // Four digits that do not match prove nothing when the PIN may have five or six.
      expect(screen.queryByText('PinAttemptsRemaining')).toBeNull();
    });
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
    mockPinLength = 4;
    mockVerifyPin.mockResolvedValue(true);
    await act(async () => { render(<PinEntryScreen navigation={mockNavigation} route={mockRoute} />); });
    await tap('1'); await tap('2'); await tap('3'); await tap('4');
    await waitFor(() => expect(mockVerifyPin).toHaveBeenCalledWith('1234'));
    await waitFor(() => {
      expect(mockSetUnlocked).toHaveBeenCalled();
      // Straight into the app: the PIN satisfied the lock, so bouncing back through the
      // gate would only ask again for something already answered.
      expect(mockReset).toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Main' }] });
    });
  });

  it('shows error on wrong PIN', async () => {
    mockPinLength = 4;
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
    // Auth is not a route on the session navigator: AppGate swaps to the auth tree once
    // the store reports signed-out, so no navigation call is expected here.
    expect(mockReset).not.toHaveBeenCalledWith({ index: 0, routes: [{ name: 'Auth' }] });
  });
});
