import React, { useState } from 'react';
import {
  ScrollView, StyleSheet, TouchableOpacity, View, RefreshControl,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { ProjectStackParamList } from '../../navigation/ProjectStackNavigator';
import type { MainTabParamList } from '../../navigation/MainNavigator';
import { useProjects } from '../../hooks/useProjects';
import { useProjectStore } from '../../store/projectStore';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import type { UserProject } from '../../api/types';

type Props = {
  navigation: NativeStackNavigationProp<ProjectStackParamList, 'ProjectList'>;
};

const ROLE_COLORS: Record<string, string> = {
  Admin:   '#2f6df0',
  Manager: '#0f76a8',
  Viewer:  '#7b61ff',
};

const PROJECT_GRADIENTS = [
  '#0f76a8', '#0e9f6e', '#2f6df0', '#7b61ff', '#f39c12', '#e0529c',
];

export const ProjectListScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const insets = useSafeAreaInsets();
  const { data: projects, isLoading, refetch } = useProjects();
  const { selectedProject, setSelectedProject } = useProjectStore();
  const [refreshing, setRefreshing] = useState(false);

  const handleSelect = (userProject: UserProject) => {
    setSelectedProject(userProject);
    navigation.getParent<BottomTabNavigationProp<MainTabParamList>>()?.navigate('Overview');
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <LoadingIndicator />;

  return (
    <GlassScreen dark={dark}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View>
          <Text style={[styles.headerLabel, { color: ink2 }]}>{t('TabProjects')}</Text>
          <Text style={[styles.headerCount, { color: ink }]}>
            {projects?.length ?? 0} {(projects?.length ?? 0) === 1 ? 'project' : 'projects'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.navigate('CreateProject')}
          style={[styles.addBtn, { backgroundColor: '#0f76a8' }]}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="plus" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink2} />
        }
      >
        {(projects ?? []).length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="folder-open-outline" size={52} color={ink2} />
            <Text style={[styles.emptyText, { color: ink2 }]}>{t('LabelNoProjects')}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('CreateProject')}
              style={styles.emptyBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.emptyBtnText}>{t('ButtonCreate') ?? 'Create project'}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          (projects ?? []).map((item, idx) => {
            const accentColor = PROJECT_GRADIENTS[idx % PROJECT_GRADIENTS.length];
            const isActive = selectedProject?.project.id === item.project.id;
            const initial = item.project.name.charAt(0).toUpperCase();
            const roleColor = ROLE_COLORS[item.role] ?? '#0f76a8';

            return (
              <TouchableOpacity
                key={item.id}
                onPress={() => handleSelect(item)}
                activeOpacity={0.78}
              >
                <GlassCard dark={dark} radius={20} style={[styles.card, isActive && { borderColor: accentColor + '66' }]}>
                  <View style={styles.cardRow}>
                    {/* Project avatar */}
                    <View style={[styles.avatar, { backgroundColor: accentColor }]}>
                      <Text style={styles.avatarText}>{initial}</Text>
                    </View>

                    {/* Info */}
                    <View style={styles.cardInfo}>
                      <Text style={[styles.projectName, { color: ink }]} numberOfLines={1}>
                        {item.project.name}
                      </Text>
                      <View style={styles.metaRow}>
                        <Text style={[styles.metaCurrency, { color: ink2 }]}>
                          {item.project.preferredCurrency}
                        </Text>
                        <View style={[styles.roleBadge, { backgroundColor: roleColor + '22' }]}>
                          <Text style={[styles.roleText, { color: roleColor }]}>{item.role}</Text>
                        </View>
                      </View>
                    </View>

                    {/* Active check */}
                    {isActive ? (
                      <MaterialCommunityIcons name="check-circle" size={22} color={accentColor} />
                    ) : (
                      <MaterialCommunityIcons name="chevron-right" size={20} color={ink2} />
                    )}
                  </View>

                  {/* Budget progress bar placeholder */}
                  {isActive && (
                    <View style={[styles.activeLine, { backgroundColor: accentColor }]} />
                  )}
                </GlassCard>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 14,
  },
  headerLabel: { fontSize: 12.5, fontWeight: '600' },
  headerCount: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  addBtn: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#0f76a8', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },

  list: { paddingHorizontal: 18, gap: 10 },

  emptyWrap: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, textAlign: 'center', opacity: 0.7 },
  emptyBtn: {
    marginTop: 8, paddingHorizontal: 22, paddingVertical: 13,
    borderRadius: 14, backgroundColor: '#0f76a8',
  },
  emptyBtnText: { color: '#fff', fontWeight: '800', fontSize: 14.5 },

  card: { overflow: 'hidden' },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16,
  },
  avatar: {
    width: 46, height: 46, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  avatarText: { color: '#fff', fontWeight: '800', fontSize: 20 },
  cardInfo: { flex: 1, gap: 4 },
  projectName: { fontSize: 15.5, fontWeight: '700' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaCurrency: { fontSize: 12.5, fontWeight: '600' },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  roleText: { fontSize: 11, fontWeight: '700' },

  activeLine: { height: 3, marginHorizontal: 16, borderRadius: 999, marginBottom: 12 },
});
