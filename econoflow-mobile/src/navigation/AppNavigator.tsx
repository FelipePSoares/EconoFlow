import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import { useBiometricStore } from '../store/biometricStore';
import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { OnboardingNavigator } from './OnboardingNavigator';
import { BiometricGateScreen } from '../screens/auth/BiometricGateScreen';

export type RootParamList = {
  Auth: undefined;
  BiometricGate: undefined;
  Onboarding: undefined;
  Main: undefined;
};

const Root = createNativeStackNavigator<RootParamList>();

export const AppNavigator: React.FC = () => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const needsOnboarding = useAuthStore((s) => s.needsOnboarding);
  const biometricEnabled = useBiometricStore((s) => s.biometricEnabled);

  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        biometricEnabled ? (
          <Root.Screen name="BiometricGate" component={BiometricGateScreen} />
        ) : needsOnboarding ? (
          <Root.Screen name="Onboarding" component={OnboardingNavigator} />
        ) : (
          <Root.Screen name="Main" component={MainNavigator} />
        )
      ) : (
        <Root.Screen name="Auth" component={AuthNavigator} />
      )}
    </Root.Navigator>
  );
};
