import { sessionEntryScreen } from '../sessionEntry';

/**
 * The session's first screen (#1116).
 *
 * This is a pure function on purpose: it is what `SessionNavigator` mounts on, so it is the
 * place the decision can be tested without a navigator, a render, or a screen that would
 * otherwise have to navigate itself into existence.
 */
describe('sessionEntryScreen', () => {
  it('asks for a PIN to be created when the device has none', () => {
    expect(sessionEntryScreen({ hasPin: false, biometricEnabled: false })).toBe('PinSetup');
  });

  it('still asks for the PIN first when biometrics are on', () => {
    // The PIN is the lock; biometrics only shortcut it, so a session protected by nothing
    // must not open on the sensor offer.
    expect(sessionEntryScreen({ hasPin: false, biometricEnabled: true })).toBe('PinSetup');
  });

  it('goes to the sensor when the device has a PIN and biometrics on', () => {
    expect(sessionEntryScreen({ hasPin: true, biometricEnabled: true })).toBe('BiometricGate');
  });

  it('goes to the keypad when biometrics are off', () => {
    expect(sessionEntryScreen({ hasPin: true, biometricEnabled: false })).toBe('PinEntry');
  });

  it('never returns a screen that has to find its own way forward', () => {
    // Every value is a screen the stack can sit on: `PinSetup` and `PinEntry` wait for the
    // customer, the gate asks the sensor. None of them is `BiometricEnroll`, which used to
    // be reached by a redirect that React Navigation dropped.
    const screens = [
      sessionEntryScreen({ hasPin: true, biometricEnabled: true }),
      sessionEntryScreen({ hasPin: true, biometricEnabled: false }),
      sessionEntryScreen({ hasPin: false, biometricEnabled: true }),
      sessionEntryScreen({ hasPin: false, biometricEnabled: false }),
    ];

    expect(new Set(screens)).toEqual(new Set(['BiometricGate', 'PinEntry', 'PinSetup']));
  });
});
