import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ProjectListScreen } from '../screens/projects/ProjectListScreen';
import { CreateProjectScreen } from '../screens/projects/CreateProjectScreen';
import { SmartSetupScreen } from '../screens/projects/SmartSetupScreen';

export type CreateProjectParams = { fromOnboarding?: boolean };
export type SmartSetupParams = { projectId: string; fromOnboarding?: boolean };

export type ProjectStackParamList = {
  ProjectList: undefined;
  CreateProject: CreateProjectParams;
  SmartSetup: SmartSetupParams;
};

const Stack = createNativeStackNavigator<ProjectStackParamList>();

export const ProjectStackNavigator: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Stack.Navigator>
      <Stack.Screen
        name="ProjectList"
        component={ProjectListScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateProject"
        component={CreateProjectScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SmartSetup"
        component={SmartSetupScreen}
        options={{ headerShown: false, title: t('SmartSetupTitle') }}
      />
    </Stack.Navigator>
  );
};
