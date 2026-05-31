import React, { useEffect, useState } from 'react';
import {
  StyleSheet, TouchableOpacity, View,
  ScrollView, RefreshControl, useColorScheme,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useAuthStore } from '../../store/authStore';
import { useProjects } from '../../hooks/useProjects';
import { useCategoriesForMonth } from '../../hooks/useCategories';
import { useIncomesForMonth } from '../../hooks/useIncomes';
import { useTotalSavedForMonth } from '../../hooks/usePlans';
import { MonthNavigator } from '../../components/common/MonthNavigator';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { AuroraMesh } from '../../components/common/AuroraMesh';
import { GlassCard } from '../../components/common/GlassCard';
import { currentMonth } from '../../utils/date';
import {
  calculateTotalBudget,
  calculateTotalExpenses,
  calculateTotalIncome,
} from '../../utils/budget';
import { getCategoryColor } from '../../utils/categoryTheme';

type Props = {
  navigation: NativeStackNavigationProp<OverviewStackParamList, 'MonthlyOverview'>;
};

function fmtCompact(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString('pt-BR');
}

export const MonthlyOverviewScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const dark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(currentMonth());
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuthStore();
  const { selectedProject, currency, setSelectedProject } = useProjectStore();
  const { data: projects } = useProjects();
  const projectId = selectedProject?.project.id ?? '';

  const {
    data: categories, isLoading: loadingCats,
    isError: catsError, refetch: refetchCats,
  } = useCategoriesForMonth(projectId, month);
  const {
    data: incomes, isLoading: loadingInc,
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

  const ink  = dark ? '#e6edf3' : '#0d2137';
  const ink2 = dark ? '#8aa0b6' : '#5b6b7c';
  const bg   = dark ? '#061e33' : '#e6eff6';
  const hair = dark ? 'rgba(255,255,255,0.08)' : 'rgba(13,33,55,0.08)';

  if (!selectedProject) {
    return (
      <View style={[styles.fill, { backgroundColor: bg, paddingTop: insets.top }]}>
        <AuroraMesh dark={dark} />
        <View style={styles.emptyCenter}>
          <MaterialCommunityIcons name="folder-open-outline" size={52} color={ink2} />
          <Text style={[styles.emptyText, { color: ink2 }]}>{t('LabelNoProjects')}</Text>
        </View>
      </View>
    );
  }

  if (loadingCats || loadingInc) return <LoadingIndicator />;

  const totalIncome   = calculateTotalIncome(incomes ?? []);
  const totalExpenses = calculateTotalExpenses(categories ?? []);
  const totalBudget   = calculateTotalBudget(categories ?? []);
  const balance       = totalIncome - totalExpenses;
  const budgetPct     = totalBudget > 0
    ? Math.min(Math.round((totalExpenses / totalBudget) * 100), 100)
    : 0;
  const remaining     = Math.max(totalBudget - totalExpenses, 0);
  const activeCategories = (categories ?? []).filter(c => !c.isArchived);

  return (
    <View style={[styles.fill, { backgroundColor: bg }]}>
      <AuroraMesh dark={dark} />

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
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {selectedProject.project.name[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View>
              <Text style={[styles.greeting, { color: ink2 }]}>
                {t('LabelHello') ?? 'Hello'} 👋
              </Text>
              <Text style={[styles.projectName, { color: ink }]}>
                {selectedProject.project.name}
              </Text>
            </View>
          </View>
          <GlassCard dark={dark} radius={14} intensity={40} style={styles.notifCard}>
            <MaterialCommunityIcons name="bell-outline" size={22} color="#0f76a8" />
          </GlassCard>
        </View>

        {/* ── Month navigator ──────────────────────────────────────────────── */}
        <MonthNavigator month={month} onChange={setMonth} dark={dark} />

        {/* ── Error ────────────────────────────────────────────────────────── */}
        {(catsError || incError) && (
          <View style={styles.errorBanner}>
            <MaterialCommunityIcons name="alert-circle-outline" size={15} color="#e74c3c" />
            <Text style={styles.errorText}>{t('ErrorGeneric')}</Text>
          </View>
        )}

        {/* ── Balance hero ─────────────────────────────────────────────────── */}
        <GlassCard dark={dark} radius={28} intensity={55} style={styles.heroCard}>
          <View style={styles.heroPad}>
            <Text style={[styles.heroLabel, { color: ink2 }]}>
              {t('LabelBalance')} · {currency}
            </Text>
            <Text style={[styles.heroBalance, { color: ink }]} adjustsFontSizeToFit numberOfLines={1}>
              {balance < 0 ? '−' : ''}{currency} {fmtCompact(balance)}
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
                  {currency} {fmtCompact(totalIncome)}
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
                  {currency} {fmtCompact(totalExpenses)}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </GlassCard>

        {/* ── Budget + Saved row ───────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          <GlassCard dark={dark} radius={22} intensity={40} style={styles.budgetCard}>
            <View style={styles.budgetInner}>
              <View style={[styles.ringOuter, { borderColor: '#0f76a8' + '44' }]}>
                <View style={[
                  styles.ringProgress,
                  {
                    borderTopColor: '#0f76a8',
                    borderLeftColor: '#0f76a8',
                    borderRightColor: 'transparent',
                    borderBottomColor: budgetPct > 50 ? '#0f76a8' : 'transparent',
                    transform: [{ rotate: '-45deg' }],
                  },
                ]} />
                <View style={styles.ringCenter}>
                  <Text style={[styles.ringPct, { color: ink }]}>{budgetPct}%</Text>
                </View>
              </View>

              <View style={styles.budgetMeta}>
                <Text style={[styles.budgetMetaLabel, { color: ink2 }]}>{t('Budget')}</Text>
                <Text style={[styles.budgetMetaAmt, { color: ink }]}>
                  {currency} {fmtCompact(remaining)}
                </Text>
                <Text style={[styles.budgetMetaSub, { color: ink2 }]}>
                  {t('Remaining') ?? 'remaining'}
                </Text>
                <View style={[styles.budgetBar, { backgroundColor: '#0f76a8' + '22' }]}>
                  <View style={[styles.budgetBarFill, { width: `${budgetPct}%` as `${number}%` }]} />
                </View>
              </View>
            </View>
          </GlassCard>

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
                {loadingSaved ? '—' : `${currency} ${fmtCompact(totalSaved)}`}
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
              {activeCategories.map((cat, idx) => {
                const spent  = cat.expenses.reduce((s, e) => s + e.amount, 0);
                const budget = cat.expenses.reduce((s, e) => s + e.budget, 0);
                const pct    = budget > 0 ? Math.min(spent / budget, 1) : 0;
                const color  = getCategoryColor(idx);

                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => navigation.navigate('ExpenseList', {
                      categoryId: cat.id, categoryName: cat.name, month,
                    })}
                    activeOpacity={0.78}
                  >
                    <GlassCard dark={dark} radius={18} intensity={30} style={styles.catCard}>
                      <View style={styles.catRow}>
                        <View style={[styles.catIcon, { backgroundColor: color + (dark ? '30' : '22') }]}>
                          <MaterialCommunityIcons name="shape-outline" size={20} color={color} />
                        </View>
                        <View style={styles.catInfo}>
                          <Text style={[styles.catName, { color: ink }]}>{cat.name}</Text>
                          <Text style={[styles.catSub, { color: ink2 }]}>
                            {cat.expenses.length} items · {Math.round(pct * 100)}%
                          </Text>
                          <View style={[styles.catTrack, { backgroundColor: color + '22' }]}>
                            <View style={[
                              styles.catFill,
                              { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: color },
                            ]} />
                          </View>
                        </View>
                        <Text style={[styles.catAmt, { color: '#e74c3c' }]}>
                          {currency} {fmtCompact(spent)}
                        </Text>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={ink2} />
                      </View>
                    </GlassCard>
                  </TouchableOpacity>
                );
              })}
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
  avatarText:  { color: '#fff', fontWeight: '800', fontSize: 18 },
  greeting:    { fontSize: 12.5, fontWeight: '600' },
  projectName: { fontSize: 16, fontWeight: '800' },
  notifCard:   { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },

  errorBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 18, marginBottom: 10, padding: 10, borderRadius: 10,
    backgroundColor: 'rgba(231,76,60,0.12)', borderWidth: 1, borderColor: 'rgba(231,76,60,0.28)',
  },
  errorText: { color: '#e74c3c', fontSize: 13 },

  heroCard:    { marginHorizontal: 18, marginBottom: 12 },
  heroPad:     { padding: 22 },
  heroLabel:   { fontSize: 13, fontWeight: '600', opacity: 0.85, marginBottom: 4 },
  heroBalance: { fontSize: 40, fontWeight: '800', letterSpacing: -1 },
  heroRow:     { flexDirection: 'row', marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth },
  heroStat:    { flex: 1, gap: 4 },
  heroStatHead:  { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.85 },
  heroStatTitle: { fontSize: 11.5, fontWeight: '600' },
  heroStatAmt:   { fontSize: 17, fontWeight: '700' },
  heroDivider:   { width: 1, marginHorizontal: 18 },

  summaryRow: { flexDirection: 'row', marginHorizontal: 18, gap: 12, marginBottom: 20 },

  budgetCard:       { flex: 1 },
  budgetInner:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  ringOuter:        { width: 56, height: 56, borderRadius: 28, borderWidth: 7, alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' },
  ringProgress:     { position: 'absolute', width: 56, height: 56, borderRadius: 28, borderWidth: 7 },
  ringCenter:       { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  ringPct:          { fontSize: 11.5, fontWeight: '800' },
  budgetMeta:       { flex: 1, gap: 1 },
  budgetMetaLabel:  { fontSize: 12, fontWeight: '600' },
  budgetMetaAmt:    { fontSize: 15, fontWeight: '800' },
  budgetMetaSub:    { fontSize: 11 },
  budgetBar:        { height: 4, borderRadius: 2, marginTop: 5, overflow: 'hidden' },
  budgetBarFill:    { height: 4, borderRadius: 2, backgroundColor: '#0f76a8' },

  savedCard:  { width: 112 },
  savedInner: { gap: 5, padding: 14, flex: 1, borderRadius: 22 },
  savedLabel: { fontSize: 11.5, fontWeight: '600', marginTop: 4 },
  savedAmt:   { fontSize: 17, fontWeight: '800' },

  sectionHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  viewAll:      { fontSize: 12.5, fontWeight: '700', color: '#0f76a8' },

  catList: { paddingHorizontal: 18, gap: 10 },
  catCard: {},
  catRow:  { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  catIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  catInfo: { flex: 1, gap: 3 },
  catName: { fontSize: 14.5, fontWeight: '700' },
  catSub:  { fontSize: 12 },
  catTrack:{ height: 4, borderRadius: 2, marginTop: 3, overflow: 'hidden' },
  catFill: { height: 4, borderRadius: 2 },
  catAmt:  { fontSize: 14, fontWeight: '800' },

  emptyCats: { alignItems: 'center', paddingVertical: 48, gap: 12 },
});
