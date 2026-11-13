import React from 'react';
import { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainNavigator } from './MainNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { BiometricGateScreen } from '../screens/auth/BiometricGateScreen';
import { BiometricEnrollScreen } from '../screens/auth/BiometricEnrollScreen';
import { PinSetupScreen } from '../screens/auth/PinSetupScreen';
import { PinEntryScreen } from '../screens/auth/PinEntryScreen';
import { isBiometricAnswerKnown, useBiometricStore } from '../store/biometricStore';
import { isPinAnswerKnown, usePinStore } from '../store/pinStore';
import { sessionEntryScreen } from './sessionEntry';
import type { StoredUnlock } from './sessionEntry';
import { setSessionRoute } from './sessionRoute';
import { trace } from '../diagnostics/trace';

/**
 * Everything reachable once you are signed in.
 *
 * This is a navigator of its own — not screens on the root stack — for one specific
 * reason: the entry point into a session differs (the PIN, the sensor, or straight to Main),
 * and `AppGate` chooses it by mounting this navigator (once, per session) rather than by
 * adding screens to the root.
 *
 * **The first screen is chosen here, from the stored unlock, not by the screens** (#1116).
 * `AppGate` does not mount this navigator until both lock stores have answered, so the route
 * named below is known to be the right one at mount time. `initialRouteName` is only read on
 * mount, which is exactly what makes it reliable where a `reset` sent from a screen's mount
 * effect was dropped by React Navigation.
 */
export type SessionParamList = {
  BiometricGate: undefined;
  BiometricEnroll: undefined;
  PinSetup: undefined;
  PinEntry: undefined;
  Onboarding: undefined;
  Main: undefined;
};

const Stack = createNativeStackNavigator<SessionParamList>();

export const SessionNavigator: React.FC = () => {
  // Read once, from the stores' current state, and never subscribed to.
  //
  // This used to be two `useSyncExternalStore` subscriptions plus `usePinStore()` /
  // `useBiometricStore()` called with no selector — i.e. the whole store. So *any* change to
  // either store re-rendered this component: the one `setPin` makes when the customer creates
  // their PIN, and the one the offer makes when they answer it. A re-render here is not
  // harmless, because it rebuilds `<Stack.Navigator>`, and React Navigation then mounts the
  // stack again on its `initialRouteName`, silently dropping the navigation that had just been
  // dispatched. The trail shows exactly that, a tenth of a second apart:
  //
  //   pinsetup.navigate.dispatch {"target":"BiometricEnroll","onScreen":true}
  //   screen.unmount {"screen":"PinSetup"}
  //   session.mount {"entry":"PinEntry","hasPin":true,"biometricEnabled":false}
  //
  // Nothing here needs to *react* to those stores: the entry screen is decided once, when the
  // session opens, and every later move through the session is made by the screens themselves
  // (`PinSetup` → `BiometricEnroll` → `Main`, `PinEntry` → `Main`, the offer → `Main`). So the
  // answers are read through `getState()` in a lazy initialiser, and this component never
  // re-renders because of them.
  //
  // `AppGate` is what waits for the answers before mounting this navigator, so the lazy read
  // below always finds them; the `null` case is only the frame before that.
  const [decided] = useState<StoredUnlock | null>(() =>
    answersReady() ? readStoredUnlock() : null,
  );

  const entry = decided ? sessionEntryScreen(decided) : null;

  // The session's current route is published for the pieces rendered outside this stack
  // (`LockOverlay`, rendered by `App` over everything): a restart mounts both at once, and the
  // overlay must not cover — or prompt on top of — the unlock gate (#1116).
  //
  // Published before the early return below, so the hook order never depends on whether the
  // answers were ready: a `useEffect` after a conditional return is the one thing React
  // forbids outright.
  useEffect(() => {
    setSessionRoute(entry);
    return () => setSessionRoute(null);
  }, [entry]);

  // Deciding before the answers arrive is the defect this navigator exists to prevent; the
  // moment between them is a frame, and `AppGate` normally covers it entirely.
  if (!decided || !entry) return null;

  // One line per mount: the route the session opens on is the fact every blank-screen report
  // turns on, and it is only knowable from here (see `src/utils/trace.ts`).
  trace('session.mount', { entry, ...decided });

  return (
    <Stack.Navigator initialRouteName={entry} screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BiometricGate" component={BiometricGateScreen} />
      <Stack.Screen name="BiometricEnroll" component={BiometricEnrollScreen} />
      <Stack.Screen name="PinSetup" component={PinSetupScreen} />
      <Stack.Screen name="PinEntry" component={PinEntryScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      <Stack.Screen name="Main" component={MainNavigator} />
    </Stack.Navigator>
  );
};

/** Whether both lock stores have answered (a default is not an answer — see #1116). */
function answersReady(): boolean {
  return isPinAnswerKnown() && isBiometricAnswerKnown();
}

/** What the device stores, read without subscribing to it. */
function readStoredUnlock(): StoredUnlock {
  const { hasPin } = usePinStore.getState();
  const { biometricEnabled } = useBiometricStore.getState();
  return { hasPin, biometricEnabled };
}


