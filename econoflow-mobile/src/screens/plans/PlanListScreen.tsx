import React, { useState, useEffect } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { PlansStackParamList } from '../../navigation/PlansStackNavigator';
import type { MainTabParamList } from '../../navigation/MainNavigator';
import { useProjectStore } from '../../store/projectStore';
import { usePlans, useArchivePlan } from '../../hooks/usePlans';
import { PlanCard } from '../../components/plans/PlanCard';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { GlassScreen } from '../../components/common/GlassScreen';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { captureError } from '../../monitoring/sentry';

type Props = NativeStackScreenProps<PlansStackParamList, 'PlanList'>;

export const PlanListScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const insets = useSafeAreaInsets();
  const [dismissedError, setDismissedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { selectedProject, currency } = useProjectStore();
  const canEdit = selectedProject?.role !== 'Viewer';
  const projectId = selectedProject?.project.id ?? '';

  const { data: plans, isLoading, isFetching, isError, error: plansError, refetch } = usePlans(projectId);
  const archivePlan = useArchivePlan(projectId);

  useEffect(() => {
    if (plansError) captureError(plansError, { screen: 'PlanListScreen', action: 'fetchPlans' });
  }, [plansError]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <LoadingIndicator />;

  const activePlans = (plans ?? []).filter((p) => !p.isArchived);

  return (
    <GlassScreen dark={dark}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() =>
            navigation
              .getParent<BottomTabNavigationProp<MainTabParamList>>()
              ?.navigate('Overview')
          }
          style={[styles.headerBtn, { borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)' }]}
          activeOpacity={0.7}
          testID="header-back-btn"
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={ink} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ink }]}>{t('PlanList')}</Text>
        {/* Spacer keeps title centred */}
        <View style={styles.headerBtn} testID="header-title-spacer" />
      </View>

      {isError && !dismissedError && (
        <ErrorBanner
          visible
          message={t('ErrorGeneric')}
          onDismiss={() => setDismissedError(true)}
        />
      )}

      <FlatList
        style={{ opacity: isFetching && !!plans ? 0.55 : 1 }}
        data={activePlans}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PlanCard
            plan={item}
            currency={currency}
            dark={dark}
            onPress={() => navigation.navigate('PlanDetail', { planId: item.id, planName: item.name })}
            onSwipeAction={canEdit ? () => {
              archivePlan.mutate(item.id, {
                onError: (err) => captureError(err, { screen: 'PlanListScreen', action: 'archivePlan' }),
              });
            } : undefined}
            swipeDisabled={!canEdit}
          />
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: ink2 }]}>{t('NoPlansYet')}</Text>
        }
        ListFooterComponent={
          canEdit ? (
            <View style={styles.createBtnWrap}>
              <AuroraPrimaryButton
                label={t('CreatePlan')}
                onPress={() => navigation.navigate('PlanForm', {})}
                icon="plus"
              />
            </View>
          ) : null
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink2} />
        }
      />

    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  list: { paddingTop: 8 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 14, opacity: 0.6 },
  createBtnWrap: { marginHorizontal: 16, marginTop: 16 },
});
