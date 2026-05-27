import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProjectListScreen } from '../screens/projects/ProjectListScreen';
import { CreateProjectScreen } from '../screens/projects/CreateProjectScreen';
import { MonthlyOverviewScreen } from '../screens/monthly/MonthlyOverviewScreen';
import { ExpenseListScreen } from '../screens/expenses/ExpenseListScreen';
import { ExpenseFormScreen } from '../screens/expenses/ExpenseFormScreen';

export type ProjectStackParamList = {
  ProjectList: undefined;
  CreateProject: undefined;
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
};

const Stack = createNativeStackNavigator<ProjectStackParamList>();

export const ProjectStackNavigator: React.FC = () => (
  <Stack.Navigator>
    <Stack.Screen name="ProjectList" component={ProjectListScreen} options={{ title: 'Projects' }} />
    <Stack.Screen name="CreateProject" component={CreateProjectScreen} options={{ title: 'New Project' }} />
    <Stack.Screen name="MonthlyOverview" component={MonthlyOverviewScreen} options={{ title: 'Overview' }} />
    <Stack.Screen
      name="ExpenseList"
      component={ExpenseListScreen}
      options={({ route }) => ({ title: route.params.categoryName })}
    />
    <Stack.Screen name="ExpenseForm" component={ExpenseFormScreen} options={{ title: 'Expense' }} />
  </Stack.Navigator>
);
