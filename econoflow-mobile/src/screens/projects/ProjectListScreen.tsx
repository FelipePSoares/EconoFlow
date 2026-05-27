import React, { useEffect } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Card, FAB, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProjectStackParamList } from '../../navigation/ProjectStackNavigator';
import { useProjects } from '../../hooks/useProjects';
import { useProjectStore } from '../../store/projectStore';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import type { UserProject } from '../../api/types';

type Props = {
  navigation: NativeStackNavigationProp<ProjectStackParamList, 'ProjectList'>;
};

export const ProjectListScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { data: projects, isLoading } = useProjects();
  const { selectedProject, setSelectedProject } = useProjectStore();

  useEffect(() => {
    if (selectedProject) {
      navigation.navigate('MonthlyOverview');
    }
  }, []);

  const handleSelect = (userProject: UserProject) => {
    setSelectedProject(userProject);
    navigation.navigate('MonthlyOverview');
  };

  if (isLoading) return <LoadingIndicator />;

  return (
    <View style={styles.container}>
      <FlatList
        data={projects}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Card style={styles.card} onPress={() => handleSelect(item)}>
            <Card.Content>
              <Text variant="titleMedium">{item.project.name}</Text>
              <Text variant="bodySmall" style={styles.meta}>
                {item.project.preferredCurrency} · {item.role}
              </Text>
            </Card.Content>
          </Card>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('LabelNoProjects') ?? 'No projects yet. Create one!'}</Text>
        }
        contentContainerStyle={styles.list}
      />
      <FAB icon="plus" style={styles.fab} onPress={() => navigation.navigate('CreateProject')} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 16, paddingBottom: 80 },
  card: { marginBottom: 12 },
  meta: { marginTop: 4, opacity: 0.6 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.5 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
