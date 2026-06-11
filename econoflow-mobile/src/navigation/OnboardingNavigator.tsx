import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileSetupScreen } from '../screens/onboarding/ProfileSetupScreen';

export type OnboardingParamList = {
  ProfileSetup: undefined;
};

const Stack = createNativeStackNavigator<OnboardingParamList>();

export const OnboardingNavigator: React.FC = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
  </Stack.Navigator>
);
