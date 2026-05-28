import React from 'react';
import type { ComponentProps } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ProjectStackNavigator } from './ProjectStackNavigator';
import { OverviewStackNavigator } from './OverviewStackNavigator';
import { ProfileScreen } from '../screens/profile/ProfileScreen';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export type MainTabParamList = {
  Projects: undefined;
  Overview: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export const MainNavigator: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      initialRouteName="Overview"
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          const icons: Record<string, IconName> = {
            Projects: 'folder-multiple',
            Overview: 'view-dashboard',
            Profile: 'account-circle',
          };
          return <MaterialCommunityIcons name={icons[route.name] ?? 'circle'} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen
        name="Projects"
        component={ProjectStackNavigator}
        options={{ tabBarLabel: t('TabProjects') }}
      />
      <Tab.Screen
        name="Overview"
        component={OverviewStackNavigator}
        options={{ tabBarLabel: t('TabOverview') }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ headerShown: true, tabBarLabel: t('TabProfile') }}
      />
    </Tab.Navigator>
  );
};
