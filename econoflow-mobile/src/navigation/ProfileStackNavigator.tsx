import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditNameScreen } from '../screens/profile/EditNameScreen';
import { ChangePasswordScreen } from '../screens/profile/ChangePasswordScreen';
import { ChangeEmailScreen } from '../screens/profile/ChangeEmailScreen';
import { LanguagePickerScreen } from '../screens/profile/LanguagePickerScreen';
import { TwoFactorScreen } from '../screens/profile/TwoFactorScreen';

export type ProfileStackParamList = {
  Profile: undefined;
  EditName: undefined;
  ChangePassword: undefined;
  ChangeEmail: undefined;
  LanguagePicker: undefined;
  TwoFactorSetup: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export const ProfileStackNavigator: React.FC = () => (
  <Stack.Navigator>
    <Stack.Screen name="Profile" component={ProfileScreen} options={{ headerShown: false }} />
    <Stack.Screen name="EditName" component={EditNameScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ChangeEmail" component={ChangeEmailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="LanguagePicker" component={LanguagePickerScreen} options={{ headerShown: false }} />
    <Stack.Screen name="TwoFactorSetup" component={TwoFactorScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);
