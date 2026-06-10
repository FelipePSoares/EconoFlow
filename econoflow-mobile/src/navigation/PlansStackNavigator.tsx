import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { PlanListScreen } from '../screens/plans/PlanListScreen';
import { PlanDetailScreen } from '../screens/plans/PlanDetailScreen';
import { PlanFormScreen } from '../screens/plans/PlanFormScreen';
import { PlanEntryFormScreen } from '../screens/plans/PlanEntryFormScreen';

export type PlansStackParamList = {
  PlanList: undefined;
  PlanDetail: { planId: string; planName: string };
  PlanForm: { planId?: string; initialValues?: { type: 'Savings' | 'EmergencyReserve'; name: string; targetAmount: number } };
  PlanEntryForm: { planId: string; planName: string };
};

const Stack = createNativeStackNavigator<PlansStackParamList>();

export const PlansStackNavigator: React.FC = () => (
  <Stack.Navigator>
    <Stack.Screen name="PlanList" component={PlanListScreen} options={{ headerShown: false }} />
    <Stack.Screen name="PlanDetail" component={PlanDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="PlanForm" component={PlanFormScreen} options={{ headerShown: false }} />
    <Stack.Screen name="PlanEntryForm" component={PlanEntryFormScreen} options={{ headerShown: false }} />
  </Stack.Navigator>
);
