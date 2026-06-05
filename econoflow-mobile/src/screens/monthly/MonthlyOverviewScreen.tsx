import React, { useEffect, useState } from 'react';
import {
  Alert, StyleSheet, TouchableOpacity, View,
  ScrollView, RefreshControl,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import type { MainTabParamList } from '../../navigation/MainNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useQuickAddStore } from '../../store/quickAddStore';
import { useAuthStore } from '../../store/authStore';
import { useProjects } from '../../hooks/useProjects';
import { useCategoriesForMonth } from '../../hooks/useCategories';
import { useIncomesForMonth } from '../../hooks/useIncomes';
import { useTotalSavedForMonth } from '../../hooks/usePlans';
import { MonthNavigator } from '../../components/common/MonthNavigator';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassScreen } from '../../components/common/GlassScreen';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { currentMonth } from '../../utils/date';
import {
  calculateTotalBudget,
  calculateTotalExpenses,
  calculateTotalIncome,
  calculateTotalOverspend,
  calculateRemainingBudget,
} from '../../utils/budget';
import { getCurrencySymbol } from '../../utils/currency';
import { CategoryCard } from '../../components/budget/CategoryCard';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';
import { DonutRing } from '../../components/common/DonutRing';

type Props = {
  navigation: NativeStackNavigationProp<OverviewStackParamList, 'MonthlyOverview'>;
};

function fmtCompact(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString();
}

export const MonthlyOverviewScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2, hair } = useAuroraSkin();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(currentMonth());
  const [refreshing, setRefreshing] = useState(false);
  const [dismissedForMonth, setDismissedForMonth] = useState<string | null>(null);

  const setViewedMonth = useQuickAddStore(s => s.setViewedMonth);
  const isFocused = useIsFocused();
  useEffect(() => {
    setViewedMonth(isFocused ? month : null);
  }, [month, isFocused, setViewedMonth]);

  const { user } = useAuthStore();
  const { selectedProject, currency, setSelectedProject } = useProjectStore();
  const { data: projects } = useProjects();
  const projectId = selectedProject?.project.id ?? '';

  const {
    data: categories, isLoading: loadingCats, isFetching: fetchingCats,
    isError: catsError, refetch: refetchCats,
  } = useCategoriesForMonth(projectId, month);
  const {
    data: incomes, isLoading: loadingInc, isFetching: fetchingIncs,
    isError: incError, refetch: refetchIncs,
  } = useIncomesForMonth(projectId, month);
  const { totalSaved, isLoading: loadingSaved } = useTotalSavedForMonth(projectId, month);

  useEffect(() => {
    if (selectedProject || !projects?.length) return;
    const pick =
      (user?.defaultProjectId
        ? projects.find(p => p.project.id === user.defaultProjectId)
        : null) ?? projects[0];
    if (pick) setSelectedProject(pick);
  }, [projects, selectedProject, user, setSelectedProject]);

  // Header is hidden in the navigator; clear the title so it never bleeds through
  useEffect(() => { navigation.setOptions({ title: '' }); }, [navigation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchCats(), refetchIncs()]);
    setRefreshing(false);
  };


  if (!selectedProject) {
    return (
      <GlassScreen dark={dark}>
        <View style={[styles.emptyCenter, { paddingTop: insets.top }]}>
          <MaterialCommunityIcons name="folder-open-outline" size={52} color={ink2} />
          <Text style={[styles.emptyText, { color: ink2 }]}>{t('LabelNoProjects')}</Text>
        </View>
      </GlassScreen>
    );
  }

  if ((loadingCats && !categories) || (loadingInc && !incomes)) return <LoadingIndicator />;

  const isFetchingData = fetchingCats || fetchingIncs;

  const totalIncome    = calculateTotalIncome(incomes ?? []);
  const totalExpenses  = calculateTotalExpenses(categories ?? []);
  const totalBudget    = calculateTotalBudget(categories ?? []);
  const totalOverspend = calculateTotalOverspend(categories ?? []);
  const balance        = totalIncome - totalExpenses;
  const budgetPct      = totalBudget > 0
    ? Math.round((totalExpenses / totalBudget) * 100)
    : 0;
  const remaining      = calculateRemainingBudget(categories ?? []);
  const activeCategories = (categories ?? []).filter(c => !c.isArchived);
  const sym = getCurrencySymbol(currency);

  return (
    <GlassScreen dark={dark}>
      <View style={{ flex: 1, opacity: isFetchingData ? 0.55 : 1 }}>
        <ScrollView
          style={styles.fill}
        contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={ink2}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={() =>
              navigation
                .getParent<BottomTabNavigationProp<MainTabParamList>>()
                ?.navigate('Profile')
            }
            activeOpacity={0.75}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
            <View>
              <Text style={[styles.greeting, { color: ink2 }]}>
                {t('LabelHello') ?? 'Olá'}, {user?.firstName ?? user?.email?.split('@')[0] ?? ''} 👋
              </Text>
              <Text style={[styles.projectName, { color: ink }]}>
                {selectedProject.project.name}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => Alert.alert(t('Notifications'), t('NoNotifications'))}
            activeOpacity={0.7}
          >
            <GlassCard dark={dark} radius={14} intensity={40} style={styles.notifCard}>
              <MaterialCommunityIcons name="bell-outline" size={22} color="#0f76a8" />
            </GlassCard>
          </TouchableOpacity>
        </View>

        {/* ── Month navigator ──────────────────────────────────────────────── */}
        <MonthNavigator month={month} onChange={setMonth} dark={dark} />

        {/* ── Error ────────────────────────────────────────────────────────── */}
        <ErrorBanner
          visible={(catsError || incError) && dismissedForMonth !== month}
          message={t('ErrorGeneric')}
          onDismiss={() => setDismissedForMonth(month)}
        />

        {/* ── Balance hero ─────────────────────────────────────────────────── */}
        <GlassCard dark={dark} radius={28} intensity={55} style={styles.heroCard}>
          <View style={styles.heroPad}>
            <Text style={[styles.heroLabel, { color: ink2 }]}>
              {t('LabelBalance')} · {sym}
            </Text>
            <Text style={[styles.heroBalance, { color: ink }]} adjustsFontSizeToFit numberOfLines={1}>
              {balance < 0 ? '−' : ''}{sym} {fmtCompact(balance)}
            </Text>

            <View style={[styles.heroRow, { borderTopColor: hair }]}>
              <TouchableOpacity
                style={styles.heroStat}
                onPress={() => navigation.navigate('IncomeList', { month })}
                activeOpacity={0.7}
              >
                <View style={styles.heroStatHead}>
                  <MaterialCommunityIcons name="arrow-up" size={13} color="#2ecc71" />
                  <Text style={[styles.heroStatTitle, { color: ink2 }]}>{t('LabelIncome')}</Text>
                </View>
                <Text style={[styles.heroStatAmt, { color: ink }]}>
                  {sym} {fmtCompact(totalIncome)}
                </Text>
              </TouchableOpacity>

              <View style={[styles.heroDivider, { backgroundColor: ink2 + '44' }]} />

              <TouchableOpacity
                style={styles.heroStat}
                onPress={() => navigation.navigate('CategoryList', { month })}
                activeOpacity={0.7}
              >
                <View style={styles.heroStatHead}>
                  <MaterialCommunityIcons name="arrow-down" size={13} color="#e74c3c" />
                  <Text style={[styles.heroStatTitle, { color: ink2 }]}>{t('LabelExpenses')}</Text>
                </View>
                <Text style={[styles.heroStatAmt, { color: ink }]}>
                  {sym} {fmtCompact(totalExpenses)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </GlassCard>

        {/* ── Budget + Saved row ───────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <TouchableOpacity
            style={styles.budgetCard}
            onPress={() => navigation.navigate('CategoryList', { month })}
            activeOpacity={0.75}
          >
            <GlassCard dark={dark} radius={22} intensity={40} style={styles.budgetCardInner}>
              <View style={styles.budgetInner}>
                <DonutRing
                  size={58}
                  strokeWidth={8}
                  progress={budgetPct / 100}
                  color={budgetPct > 100 ? colors.error : colors.primary}
                  trackColor={budgetPct > 100 ? colors.error + '24' : colors.primary + '24'}
                >
                  <Text style={[styles.ringPct, { color: budgetPct > 100 ? colors.error : ink }]}>{budgetPct}%</Text>
                </DonutRing>

                <View style={styles.budgetMeta}>
                  <Text style={[styles.budgetMetaLabel, { color: ink2 }]}>{t('Budget')}</Text>
                  <Text style={[styles.budgetMetaAmt, { color: ink }]}>
                    {sym} {fmtCompact(remaining)}{' '}
                    <Text style={[styles.budgetMetaSub, { color: ink2 }]}>{t('Remaining') ?? 'remaining'}</Text>
                  </Text>
                  {totalOverspend > 0 && (
                    <Text style={[styles.budgetMetaOver, { color: colors.error }]}>
                      +{sym} {fmtCompact(totalOverspend)}{' '}
                      <Text style={[styles.budgetMetaSub, { color: colors.error }]}>{t('LabelOver') ?? 'over'}</Text>
                    </Text>
                  )}
                </View>
              </View>
            </GlassCard>
          </TouchableOpacity>

          <GlassCard
            dark={dark}
            radius={22}
            intensity={40}
            style={[
              styles.savedCard,
              dark ? { borderColor: 'rgba(46,204,113,0.35)' } : { borderColor: 'transparent' },
            ]}
          >
            <View style={[styles.savedInner, !dark && { backgroundColor: '#14c08a' }]}>
              <MaterialCommunityIcons
                name="piggy-bank-outline"
                size={24}
                color={dark ? '#2ecc71' : '#fff'}
              />
              <Text style={[styles.savedLabel, { color: dark ? '#2ecc71' : 'rgba(255,255,255,0.9)' }]}>
                {t('LabelSaved')}
              </Text>
              <Text style={[styles.savedAmt, { color: dark ? '#e6edf3' : '#fff' }]}>
                {loadingSaved ? '—' : `${sym} ${fmtCompact(totalSaved)}`}
              </Text>
            </View>
          </GlassCard>
        </View>

        {/* ── Categories ───────────────────────────────────────────────────── */}
        {activeCategories.length > 0 && (
          <>
            <View style={styles.sectionHead}>
              <Text style={[styles.sectionTitle, { color: ink }]}>{t('ListCategories')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('CategoryList', { month })}>
                <Text style={styles.viewAll}>{t('ButtonViewAll') ?? 'View all'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.catList}>
              {activeCategories.map((cat, idx) => (
                <CategoryCard
                  key={cat.id}
                  category={cat}
                  currency={currency}
                  index={idx}
                  dark={dark}
                  onPress={() => navigation.navigate('ExpenseList', {
                    categoryId: cat.id, categoryName: cat.name, month, categoryIndex: idx,
                  })}
                />
              ))}
            </View>
          </>
        )}

        {activeCategories.length === 0 && !loadingCats && (
          <View style={styles.emptyCats}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={44} color={ink2} />
            <Text style={[styles.emptyText, { color: ink2 }]}>{t('LabelNoCategories')}</Text>
          </View>
        )}
        </ScrollView>
      </View>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },
  emptyCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText:   { fontSize: 15, textAlign: 'center', opacity: 0.7 },

  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8,
  },
  headerLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar:      { width: 42, height: 42, borderRadius: 14, backgroundColor: '#0f76a8', alignItems: 'center', justifyContent: 'center' },
  avatarText:  { color: '#fff', fontWeight: 'bold', fontSize: 18 },
  greeting:    { fontSize: 12.5, fontWeight: '600' },
  projectName: { fontSize: 16, fontWeight: 'bold' },
  notifCard:   { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },

  heroCard:    { marginHorizontal: 18, marginBottom: 12 },
  heroPad:     { padding: 22 },
  heroLabel:   { fontSize: 13, fontWeight: '600', opacity: 0.85, marginBottom: 4 },
  heroBalance: { fontSize: 40, fontWeight: 'bold', letterSpacing: -1 },
  heroRow:     { flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  heroStat:    { flex: 1, gap: 4 },
  heroStatHead:  { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.85 },
  heroStatTitle: { fontSize: 11.5, fontWeight: '600' },
  heroStatAmt:   { fontSize: 17, fontWeight: '700' },
  heroDivider:   { width: 1, marginHorizontal: 18 },

  summaryRow: { flexDirection: 'row', marginHorizontal: 18, gap: 12, marginBottom: 20 },

  budgetCard:       { flex: 1 },
  budgetCardInner:  { flex: 1 },
  budgetInner:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  ringPct:          { fontSize: 11.5, fontWeight: 'bold' },
  budgetMeta:       { flex: 1, gap: 1 },
  budgetMetaLabel:  { fontSize: 12, fontWeight: '600' },
  budgetMetaAmt:    { fontSize: 14, fontWeight: 'bold' },
  budgetMetaOver:   { fontSize: 13, fontWeight: '700' },
  budgetMetaSub:    { fontSize: 11 },
  savedCard:  { width: 112 },
  savedInner: { gap: 5, padding: 14, flex: 1, borderRadius: 22 },
  savedLabel: { fontSize: 11.5, fontWeight: '600', marginTop: 4 },
  savedAmt:   { fontSize: 17, fontWeight: 'bold' },

  sectionHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold' },
  viewAll:      { fontSize: 12.5, fontWeight: '700', color: '#0f76a8' },

  catList: {},

  emptyCats: { alignItems: 'center', paddingVertical: 48, gap: 12 },
});
