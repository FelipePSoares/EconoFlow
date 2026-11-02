import type { SessionParamList } from './SessionNavigator';

/**
 * Which screen a session starts on (#1116).
 *
 * The decision is a **pure function of what the device stores**, read after both lock stores
 * have answered, and it is used as the stack's `initialRouteName`. It used to be made by the
 * unlock gate itself, from an effect that ran while the stack was still mounting: its
 * `reset` was dropped by React Navigation ("The action 'RESET' … was not handled by any
 * navigator"), the gate then rendered `null`, and the customer was left on a blank screen
 * after a successful login until they restarted the app.
 *
 * Choosing the first route up front means no screen has to navigate itself into existence.
 * The screens can still move on — the PIN setup to the offer, the offer to the gate — but
 * only in response to something the customer did, once the stack is running.
 *
 * The order is the one the product promises:
 * 1. no PIN on the device → create one (`PinSetup`): the PIN is the lock, biometrics only
 *    shortcut it, and a session protected by nothing must not open on a sensor offer;
 * 2. biometrics on → `BiometricGate`, which asks the sensor as soon as it is in front;
 * 3. otherwise → `PinEntry`.
 */
export interface StoredUnlock {
  hasPin: boolean;
  biometricEnabled: boolean;
}

export type SessionEntryScreen = Extract<
  keyof SessionParamList,
  'PinSetup' | 'BiometricGate' | 'PinEntry'
>;

export const sessionEntryScreen = ({ hasPin, biometricEnabled }: StoredUnlock): SessionEntryScreen => {
  if (!hasPin) return 'PinSetup';
  return biometricEnabled ? 'BiometricGate' : 'PinEntry';
};
