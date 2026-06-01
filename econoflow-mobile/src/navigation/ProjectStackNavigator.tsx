import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ProjectListScreen } from '../screens/projects/ProjectListScreen';
import { CreateProjectScreen } from '../screens/projects/CreateProjectScreen';

export type ProjectStackParamList = {
  ProjectList: undefined;
  CreateProject: undefined;
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
        options={{ title: t('CreateEditProject') }}
      />
    </Stack.Navigator>
  );
};
