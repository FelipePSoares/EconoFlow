import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { BiometricGateScreen } from '../screens/auth/BiometricGateScreen';
import { BiometricEnrollScreen } from '../screens/auth/BiometricEnrollScreen';

export type RootParamList = {
  Auth: undefined;
  BiometricGate: undefined;
  BiometricEnroll: undefined;
  Onboarding: undefined;
  Main: undefined;
};

const Root = createNativeStackNavigator<RootParamList>();

export const AppNavigator: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Root.Screen name="BiometricGate" component={BiometricGateScreen} />
          <Root.Screen name="BiometricEnroll" component={BiometricEnrollScreen} />
          <Root.Screen name="Onboarding" component={OnboardingNavigator} />
          <Root.Screen name="Main" component={MainNavigator} />
        </>
      ) : (
        <Root.Screen name="Auth" component={AuthNavigator} />
      )}
    </Root.Navigator>
  );
};
