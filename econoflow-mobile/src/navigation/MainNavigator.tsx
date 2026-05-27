import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ProjectStackNavigator } from './ProjectStackNavigator';
import { IncomeStackNavigator } from './IncomeStackNavigator';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

export type MainTabParamList = {
  Overview: undefined;
  Incomes: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator: React.FC = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarIcon: ({ color, size }) => {
        const icons: Record<string, string> = {
          Overview: 'view-dashboard',
          Incomes: 'cash-plus',
          Profile: 'account-circle',
        };
        return <MaterialCommunityIcons name={icons[route.name] ?? 'circle'} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="Overview" component={ProjectStackNavigator} />
    <Tab.Screen name="Incomes" component={IncomeStackNavigator} />
    <Tab.Screen name="Profile" component={ProfileScreen} options={{ headerShown: true }} />
  </Tab.Navigator>
);
