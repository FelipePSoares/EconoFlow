import React from 'react';
import { useSyncExternalStore } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainNavigator } from './MainNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { BiometricGateScreen } from '../screens/auth/BiometricGateScreen';
import { BiometricEnrollScreen } from '../screens/auth/BiometricEnrollScreen';
import { PinSetupScreen } from '../screens/auth/PinSetupScreen';
import { PinEntryScreen } from '../screens/auth/PinEntryScreen';
import {
  isBiometricAnswerKnown,
  subscribeBiometricAnswering,
  useBiometricStore,
} from '../store/biometricStore';
import { isPinAnswerKnown, subscribePinAnswering, usePinStore } from '../store/pinStore';
import { sessionEntryScreen } from './sessionEntry';
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
  // Subscribed, not sampled: these values are what the stack mounts on, so the render has to
  // see the answers the moment they land (`AppGate` has already waited for them when it
  // mounts this navigator; the subscription is what keeps the two in step if it ever
  // re-renders).
  const pinKnown = useSyncExternalStore(subscribePinAnswering, isPinAnswerKnown);
  const biometricKnown = useSyncExternalStore(subscribeBiometricAnswering, isBiometricAnswerKnown);
  const { hasPin } = usePinStore();
  const { biometricEnabled } = useBiometricStore();

  const answersKnown = pinKnown && biometricKnown;
  const entry = answersKnown ? sessionEntryScreen({ hasPin, biometricEnabled }) : null;

  // Deciding before the answers arrive is the defect this navigator exists to prevent; the
  // moment between them is a frame, and `AppGate` normally covers it entirely.
  if (!entry) return null;

  // One line per mount: the route the session opens on is the fact every blank-screen report
  // turns on, and it is only knowable from here (see `src/utils/trace.ts`).
  trace('session.mount', { entry, hasPin, biometricEnabled });

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


