import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { MainNavigator } from './MainNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { BiometricGateScreen } from '../screens/auth/BiometricGateScreen';
import { BiometricEnrollScreen } from '../screens/auth/BiometricEnrollScreen';
import { PinSetupScreen } from '../screens/auth/PinSetupScreen';
import { PinEntryScreen } from '../screens/auth/PinEntryScreen';

/**
 * Everything reachable once you are signed in.
 *
 * This is a navigator of its own — not screens on the root stack — for one specific
 * reason: `onPress` must never remount the root navigator's `initialRouteName`, and the
 * entry point into a session differs (biometric gate, PIN entry, onboarding vs. straight
 * to Main). `AppGate` mounts this navigator when the auth store says you are signed in,
 * and skips the locking screens by choosing `initialRouteName`.
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
  return (
    <Stack.Navigator initialRouteName="BiometricGate" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BiometricGate" component={BiometricGateScreen} />
      <Stack.Screen name="BiometricEnroll" component={BiometricEnrollScreen} />
      <Stack.Screen name="PinSetup" component={PinSetupScreen} />
      <Stack.Screen name="PinEntry" component={PinEntryScreen} />
      <Stack.Screen name="Onboarding" component={OnboardingNavigator} />
      <Stack.Screen name="Main" component={MainNavigator} />
    </Stack.Navigator>
  );
};
