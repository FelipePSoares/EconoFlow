import React, { useState, useEffect } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PlansStackParamList } from '../../navigation/PlansStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { usePlans, usePlanEntries } from '../../hooks/usePlans';
import { PlanEntryRow } from '../../components/plans/PlanEntryRow';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { DonutRing } from '../../components/common/DonutRing';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';
import { getCurrencySymbol } from '../../utils/currency';
import { captureError } from '../../monitoring/sentry';

type Props = NativeStackScreenProps<PlansStackParamList, 'PlanDetail'>;

export const PlanDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { colors, customColors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [dismissedError, setDismissedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { selectedProject, currency } = useProjectStore();
  const canEdit = selectedProject?.role !== 'Viewer';
  const projectId = selectedProject?.project.id ?? '';
  const { planId, planName } = route.params;
  const sym = getCurrencySymbol(currency);

  const { data: plans, error: plansError } = usePlans(projectId);
  const plan = (plans ?? []).find((p) => p.id === planId);

  const {
    data: entries,
    isLoading,
    isError,
    error: entriesError,
    refetch,
  } = usePlanEntries(projectId, planId);

  useEffect(() => {
    if (plansError) captureError(plansError, { screen: 'PlanDetailScreen', action: 'fetchPlans' });
  }, [plansError]);

  useEffect(() => {
    if (entriesError) captureError(entriesError, { screen: 'PlanDetailScreen', action: 'fetchPlanEntries' });
  }, [entriesError]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <LoadingIndicator />;

  const sortedEntries = [...(entries ?? [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const pct = plan ? Math.min(plan.progress, 1) : 0;
  const isComplete = pct >= 1;
  const ringColor = isComplete ? customColors.income : colors.primary;

  return (
    <GlassScreen dark={dark}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBtn, { borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)' }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={ink} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ink }]}>{planName}</Text>
      </View>

      {isError && !dismissedError && (
        <ErrorBanner
          visible
          message={t('ErrorGeneric')}
          onDismiss={() => setDismissedError(true)}
        />
      )}

      <FlatList
        data={sortedEntries}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {/* ── Hero card ─────────────────────────────────────────── */}
            {plan && (
              <GlassCard dark={!!dark} radius={18} intensity={30} style={styles.heroCard}>
                <View style={styles.heroInner}>
                  <DonutRing
                    size={80}
                    strokeWidth={8}
                    progress={pct}
                    color={ringColor}
                    trackColor={dark ? ringColor + '33' : ringColor + '28'}
                  >
                    <Text style={[styles.pctText, { color: ink }]}>
                      {Math.round(pct * 100)}%
                    </Text>
                  </DonutRing>
                  <View style={styles.heroStats}>
                    <View style={styles.statRow}>
                      <Text style={[styles.statLabel, { color: ink2 }]}>{t('PlanTarget')}</Text>
                      <Text style={[styles.statValue, { color: ink }]}>
                        {sym} {plan.targetAmount.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.statRow}>
                      <Text style={[styles.statLabel, { color: ink2 }]}>{t('PlanCurrent')}</Text>
                      <Text style={[styles.statValue, { color: ink }]}>
                        {sym} {plan.currentBalance.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.statRow}>
                      <Text style={[styles.statLabel, { color: ink2 }]}>{t('PlanRemaining')}</Text>
                      <Text style={[styles.statValue, { color: ink }]}>
                        {sym} {plan.remaining.toLocaleString()}
                      </Text>
                    </View>
                  </View>
                </View>
              </GlassCard>
            )}

            {/* ── Add entry button ───────────────────────────────────── */}
            {canEdit && (
              <View style={styles.addBtnWrap}>
                <AuroraPrimaryButton
                  label={t('PlanAdjustBalance')}
                  onPress={() => navigation.navigate('PlanEntryForm', { planId, planName })}
                  icon="plus"
                />
              </View>
            )}

            {/* ── Entries section title ──────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: ink2 }]}>{t('PlanLedgerEntries')}</Text>
          </>
        }
        renderItem={({ item }) => (
          <PlanEntryRow entry={item} currency={currency} />
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: ink2 }]}>{t('NoPlanEntriesYet')}</Text>
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
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 17, fontWeight: '800', flex: 1, textAlign: 'center' },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    borderColor: 'transparent',
  },
  heroCard: { marginHorizontal: 16, marginTop: 8, marginBottom: 4 },
  heroInner: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroStats: { flex: 1, gap: 6 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 14, fontWeight: '700' },
  pctText: { fontSize: 12, fontWeight: '800' },
  addBtnWrap: { marginHorizontal: 16, marginTop: 12, marginBottom: 4 },
  sectionTitle: { fontSize: 11.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginHorizontal: 18, marginTop: 12, marginBottom: 4 },
  list: { paddingTop: 8 },
  empty: { textAlign: 'center', marginTop: 32, fontSize: 14, opacity: 0.6 },
});
