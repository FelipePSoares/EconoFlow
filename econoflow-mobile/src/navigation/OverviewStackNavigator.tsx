import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MonthlyOverviewScreen } from '../screens/monthly/MonthlyOverviewScreen';
import { ExpenseListScreen } from '../screens/expenses/ExpenseListScreen';
import { ExpenseFormScreen } from '../screens/expenses/ExpenseFormScreen';
import { IncomeListScreen } from '../screens/incomes/IncomeListScreen';
import { IncomeFormScreen } from '../screens/incomes/IncomeFormScreen';

export type OverviewStackParamList = {
  MonthlyOverview: undefined;
  ExpenseList: {
    categoryId: string;
    categoryName: string;
    month: string;
  };
  ExpenseForm: {
    categoryId: string;
    month: string;
    expenseId?: string;
    initialValues?: {
      name: string;
      amount: number;
      budget: number;
      date: string;
      isDeductible: boolean;
    };
  };
  IncomeList: { month: string };
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

const Stack = createNativeStackNavigator<OverviewStackParamList>();

export const OverviewStackNavigator: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="MonthlyOverview"
        component={MonthlyOverviewScreen}
        options={{ title: t('TabOverview') }}
      />
      <Stack.Screen
        name="ExpenseList"
        component={ExpenseListScreen}
        options={({ route }) => ({ title: route.params.categoryName })}
      />
      <Stack.Screen
        name="ExpenseForm"
        component={ExpenseFormScreen}
        options={{ title: t('Expense') }}
      />
      <Stack.Screen
        name="IncomeList"
        component={IncomeListScreen}
        options={{ title: t('Incomes') }}
      />
      <Stack.Screen
        name="IncomeForm"
        component={IncomeFormScreen}
        options={{ title: t('Income') }}
      />
    </Stack.Navigator>
  );
};
