import React from 'react';
import { useColorScheme } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { MonthlyOverviewScreen } from '../screens/monthly/MonthlyOverviewScreen';
import { CategoryListScreen } from '../screens/expenses/CategoryListScreen';
import { ExpenseListScreen } from '../screens/expenses/ExpenseListScreen';
import { ExpenseFormScreen } from '../screens/expenses/ExpenseFormScreen';
import { IncomeListScreen } from '../screens/incomes/IncomeListScreen';
import { IncomeFormScreen } from '../screens/incomes/IncomeFormScreen';
import { NotificationListScreen } from '../screens/notifications/NotificationListScreen';

export type OverviewStackParamList = {
  MonthlyOverview: undefined;
  NotificationCentre: undefined;
  CategoryList: { month: string };
  ExpenseList: {
    categoryId: string;
    categoryName: string;
    month: string;
    /** Index of this category in the list — used to pick the Aurora accent colour. */
    categoryIndex?: number;
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

// Aurora screens that own their own full-screen header — suppress the nav bar
const HEADERLESS = ['MonthlyOverview', 'CategoryList', 'ExpenseList', 'IncomeList', 'NotificationCentre'] as const;

export const OverviewStackNavigator: React.FC = () => {
  const { t } = useTranslation();
  const dark = useColorScheme() === 'dark';

  const secondaryHeaderStyle = { backgroundColor: dark ? '#0c1a2b' : '#e6eff6' };
  const secondaryTintColor   = dark ? '#e6edf3' : '#0d2137';

  return (
    <Stack.Navigator
      screenOptions={({ route }) => ({
        headerShown: !(HEADERLESS as readonly string[]).includes(route.name),
        headerStyle: secondaryHeaderStyle,
        headerTintColor: secondaryTintColor,
        headerShadowVisible: false,
      })}
    >
      <Stack.Screen name="MonthlyOverview" component={MonthlyOverviewScreen} />
      <Stack.Screen
        name="CategoryList"
        component={CategoryListScreen}
        options={{ title: t('Expenses') }}
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
      <Stack.Screen name="NotificationCentre" component={NotificationListScreen} />
    </Stack.Navigator>
  );
};
