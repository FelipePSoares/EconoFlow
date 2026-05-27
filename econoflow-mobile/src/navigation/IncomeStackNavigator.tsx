import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { IncomeListScreen } from '../screens/incomes/IncomeListScreen';
import { IncomeFormScreen } from '../screens/incomes/IncomeFormScreen';

export type IncomeStackParamList = {
  IncomeList: undefined;
  IncomeForm: {
    incomeId?: string;
    month?: string;
    initialValues?: {
      name: string;
      amount: number;
      date: string;
    };
  };
};

const Stack = createNativeStackNavigator<IncomeStackParamList>();

export const IncomeStackNavigator: React.FC = () => (
  <Stack.Navigator>
    <Stack.Screen name="IncomeList" component={IncomeListScreen} options={{ title: 'Incomes' }} />
    <Stack.Screen name="IncomeForm" component={IncomeFormScreen} options={{ title: 'Income' }} />
  </Stack.Navigator>
);
