import React from 'react';
import { SessionNavigator } from '../SessionNavigator';
import { act, render, screen } from '@testing-library/react-native';

/**
 * The session stack must keep the route it opened on.
 *
 * **The reported failure (every spec that creates a PIN).** `SessionNavigator` reads `hasPin`
 * from the store and hands it to `initialRouteName`. `initialRouteName` is only read when the
 * navigator mounts — but writing the PIN flips `hasPin` to `true`, which re-rendered the
 * navigator with a *new* `initialRouteName` (`PinEntry`). React Navigation's stack remounted
 * on the change, discarding the `navigation.replace('BiometricEnroll')` the PIN setup had
 * just dispatched.
 *
 * The app's own native trail shows it happening, between two events one tenth of a second
 * apart (`scripts/wsl/trail.sh`):
 *
 * ```
 * 17 pinsetup.navigate.dispatch {"target":"BiometricEnroll","onScreen":true}
 * 18 screen.unmount {"screen":"PinSetup"}
 * 19 session.mount {"entry":"PinEntry","hasPin":true,"biometricEnabled":false}
 * ```
 *
 * So the customer created the PIN, the app moved them to the biometric offer — and was then
 * put back on the keypad, where the stored PIN they just chose had to be typed to get in.
 * The Detox suite saw it as a blank wait on the offer and timed out.
 *
 * The decision belongs to the moment the session opens. What the store says *later* (the PIN
 * was just saved, the offer was just answered) describes a session already in progress, and
 * must not be able to rewrite its entry point.
 */

const mockStackScreen = jest.fn();
const mockNavigatorProps = jest.fn();

jest.mock('@react-navigation/native-stack', () => {
  const React = require('react');
  const { View } = require('react-native');
  const Stack = {
    Navigator: ({ children, ...props }: { children: React.ReactNode }) => {
      mockNavigatorProps(props);
      return React.createElement(View, { testID: 'session-stack' }, children);
    },
    Screen: ({ name }: { name: string }) => {
      mockStackScreen(name);
      return React.createElement(View, { testID: `screen-${name}` });
    },
  };
  return { createNativeStackNavigator: () => Stack };
});

const mockPinState = { hasPin: false, pinLength: 4 };
const mockBiometricState = { biometricEnabled: false, biometricPromptSkipped: false };

jest.mock('../../store/pinStore', () => {
  const subscribe = jest.fn(() => () => undefined);
  return {
    usePinStore: Object.assign(
      (selector?: (s: unknown) => unknown) => (selector ? selector(mockPinState) : mockPinState),
      { getState: () => mockPinState },
    ),
    isPinAnswerKnown: () => true,
    subscribePinAnswering: subscribe,
  };
});

jest.mock('../../store/biometricStore', () => {
  const subscribe = jest.fn(() => () => undefined);
  return {
    useBiometricStore: Object.assign(
      (selector?: (s: unknown) => unknown) =>
        selector ? selector(mockBiometricState) : mockBiometricState,
      { getState: () => mockBiometricState },
    ),
    isBiometricAnswerKnown: () => true,
    subscribeBiometricAnswering: subscribe,
  };
});

jest.mock('../../diagnostics/trace', () => ({ trace: jest.fn() }));

// The screens themselves are irrelevant here: this test is about which route the stack
// mounts on, not what any screen renders.
jest.mock('../MainNavigator', () => ({ MainNavigator: () => null }));
jest.mock('../OnboardingNavigator', () => ({ OnboardingNavigator: () => null }));
jest.mock('../../screens/auth/BiometricGateScreen', () => ({ BiometricGateScreen: () => null }));
jest.mock('../../screens/auth/BiometricEnrollScreen', () => ({ BiometricEnrollScreen: () => null }));
jest.mock('../../screens/auth/PinSetupScreen', () => ({ PinSetupScreen: () => null }));
jest.mock('../../screens/auth/PinEntryScreen', () => ({ PinEntryScreen: () => null }));

describe('SessionNavigator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPinState.hasPin = false;
    mockBiometricState.biometricEnabled = false;
  });

  it('opens a session with no PIN on the PIN setup', async () => {
    await act(async () => { render(<SessionNavigator />); });

    expect(screen.getByTestId('screen-PinSetup')).toBeTruthy();
  });

  it('opens a session with a PIN on the keypad', async () => {
    mockPinState.hasPin = true;

    await act(async () => { render(<SessionNavigator />); });

    expect(screen.getByTestId('screen-PinEntry')).toBeTruthy();
  });

  // THE REGRESSION. Saving the PIN writes `hasPin`, which used to re-render this component —
  // and a re-render here rebuilds `<Stack.Navigator>`, which tears the stack down and mounts
  // it again on `initialRouteName`, dropping the `replace('BiometricEnroll')` the PIN setup
  // had just dispatched. The subscription is what made it re-render, so the contract is:
  // the navigator props never change once the session is up.
  //
  // `rerender`, not a second `render`: a new render mounts a *new* session, which is entitled
  // to decide afresh. The defect is about this component being re-rendered *in place*, which
  // is what a store write does.
  it('keeps its entry screen when the PIN is saved during the session', async () => {
    const { rerender } = await act(async () => render(<SessionNavigator />));

    expect(mockNavigatorProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialRouteName: 'PinSetup' }),
    );

    // The PIN setup saves the PIN: `hasPin` becomes true in the middle of the session.
    mockPinState.hasPin = true;
    await act(async () => { rerender(<SessionNavigator />); });

    expect(mockNavigatorProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialRouteName: 'PinSetup' }),
    );
    // The stack is not rebuilt: every render of it named the same route, so React Navigation
    // has no new `initialRouteName` to remount on.
    expect(mockNavigatorProps.mock.calls.every(
      ([props]) => props.initialRouteName === 'PinSetup',
    )).toBe(true);
  });

  // ...and the mirror case: a session that opened on the gate stays there when the stored
  // biometric answer changes (the offer just enabled it, or the profile turned it off).
  it('keeps its entry screen when the biometric answer changes during the session', async () => {
    mockPinState.hasPin = true;
    mockBiometricState.biometricEnabled = true;

    const { rerender } = await act(async () => render(<SessionNavigator />));

    expect(screen.getByTestId('screen-BiometricGate')).toBeTruthy();

    mockBiometricState.biometricEnabled = false;
    await act(async () => { rerender(<SessionNavigator />); });

    expect(mockNavigatorProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ initialRouteName: 'BiometricGate' }),
    );
    expect(screen.getByTestId('screen-BiometricGate')).toBeTruthy();
  });
});
