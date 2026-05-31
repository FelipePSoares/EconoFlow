import React, { useEffect, useState } from 'react';
import {
  StyleSheet, TouchableOpacity, View,
  ScrollView, RefreshControl, useColorScheme,
} from 'react-native';
import { Text } from 'react-native-paper';
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

// Format a number with no cents
function fmtCompact(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString('pt-BR');
}

export const MonthlyOverviewScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const dark = useColorScheme() === 'dark';
  const [month, setMonth] = useState(currentMonth());
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuthStore();
  const { selectedProject, currency, setSelectedProject } = useProjectStore();
  const { data: projects } = useProjects();
  const projectId = selectedProject?.project.id ?? '';

  const { data: categories, isLoading: loadingCats, isError: catsError, refetch: refetchCats } =
    useCategoriesForMonth(projectId, month);
  const { data: incomes, isLoading: loadingInc, isError: incError, refetch: refetchIncs } =
    useIncomesForMonth(projectId, month);
  const { totalSaved, isLoading: loadingSaved } = useTotalSavedForMonth(projectId, month);

  useEffect(() => {
    if (selectedProject || !projects?.length) return;
    const pick =
      (user?.defaultProjectId
        ? projects.find(p => p.project.id === user.defaultProjectId)
        : null) ?? projects[0];
    if (pick) setSelectedProject(pick);
  }, [projects, selectedProject, user, setSelectedProject]);

  useEffect(() => {
    navigation.setOptions({ title: selectedProject?.project.name ?? t('TabOverview') });
  }, [selectedProject, navigation, t]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchCats(), refetchIncs()]);
    setRefreshing(false);
  };

  // ── Aurora skin tokens ────────────────────────────────────────────────────
  const ink    = dark ? '#e6edf3' : '#0d2137';
  const ink2   = dark ? '#8aa0b6' : '#5b6b7c';
  const bg     = dark ? '#061e33' : '#e6eff6';
  const hair   = dark ? 'rgba(255,255,255,0.08)' : 'rgba(13,33,55,0.08)';
  const cardBg = dark
    ? 'rgba(255,255,255,0.10)'
    : 'rgba(255,255,255,0.72)';
  const cardBorder = dark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.85)';
  const softBg = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.6)';
  const softBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.8)';

  // ── Guard states ──────────────────────────────────────────────────────────
  if (!selectedProject) {
    return (
      <View style={[styles.emptyState, { backgroundColor: bg }]}>
        <AuroraMesh dark={dark} />
        <MaterialCommunityIcons name="folder-open-outline" size={52} color={ink2} />
        <Text style={[styles.emptyText, { color: ink2, marginTop: 12 }]}>
          {t('LabelNoProjects')}
        </Text>
      </View>
    );
  }

  if (loadingCats || loadingInc) return <LoadingIndicator />;

  // ── Data ──────────────────────────────────────────────────────────────────
  const totalIncome   = calculateTotalIncome(incomes ?? []);
  const totalExpenses = calculateTotalExpenses(categories ?? []);
  const totalBudget   = calculateTotalBudget(categories ?? []);
  const balance       = totalIncome - totalExpenses;
  const budgetPct     = totalBudget > 0 ? Math.min(Math.round((totalExpenses / totalBudget) * 100), 100) : 0;
  const remaining     = Math.max(totalBudget - totalExpenses, 0);
  const activeCategories = (categories ?? []).filter(c => !c.isArchived);

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <AuroraMesh dark={dark} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink2} />}
      >
        {/* ── Header ────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(selectedProject.project.name[0] ?? '?').toUpperCase()}
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
          <View style={[styles.notifBtn, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <MaterialCommunityIcons name="bell-outline" size={22} color="#0f76a8" />
          </View>
        </View>

        {/* ── Month navigator ───────────────────────────────────────────── */}
        <MonthNavigator month={month} onChange={setMonth} dark={dark} />

        {/* ── Error banner ──────────────────────────────────────────────── */}
        {(catsError || incError) && (
          <View style={[styles.errorBanner, { backgroundColor: 'rgba(231,76,60,0.15)', borderColor: 'rgba(231,76,60,0.3)' }]}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#e74c3c" />
            <Text style={{ color: '#e74c3c', marginLeft: 8, fontSize: 13 }}>{t('ErrorGeneric')}</Text>
          </View>
        )}

        {/* ── Balance hero card ─────────────────────────────────────────── */}
        <View style={[styles.heroCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.heroLabel, { color: ink2 }]}>
            {t('LabelBalance')} · {currency}
          </Text>
          <Text style={[styles.heroBalance, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
            {balance < 0 ? '−' : ''}{currency} {fmtCompact(balance)}
          </Text>

          {/* Income / Expenses row */}
          <View style={[styles.heroRow, { borderTopColor: hair }]}>
            <TouchableOpacity
              style={styles.heroStat}
              onPress={() => navigation.navigate('IncomeList', { month })}
              activeOpacity={0.7}
            >
              <View style={styles.heroStatLabel}>
                <MaterialCommunityIcons name="arrow-up" size={14} color="#2ecc71" />
                <Text style={[styles.heroStatTitle, { color: ink2 }]}>{t('LabelIncome')}</Text>
              </View>
              <Text style={[styles.heroStatAmount, { color: dark ? '#e6edf3' : '#0d2137' }]}>
                {currency} {fmtCompact(totalIncome)}
              </Text>
            </TouchableOpacity>

            <View style={[styles.heroDivider, { backgroundColor: ink2 + '44' }]} />

            <TouchableOpacity
              style={styles.heroStat}
              onPress={() => navigation.navigate('CategoryList', { month })}
              activeOpacity={0.7}
            >
              <View style={styles.heroStatLabel}>
                <MaterialCommunityIcons name="arrow-down" size={14} color="#e74c3c" />
                <Text style={[styles.heroStatTitle, { color: ink2 }]}>{t('LabelExpenses')}</Text>
              </View>
              <Text style={[styles.heroStatAmount, { color: dark ? '#e6edf3' : '#0d2137' }]}>
                {currency} {fmtCompact(totalExpenses)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Budget + Saved row ────────────────────────────────────────── */}
        <View style={styles.summaryRow}>
          {/* Budget donut card */}
          <View style={[styles.budgetCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            {/* Simple ring indicator */}
            <View style={[styles.budgetRing, { borderColor: '#0f76a8' + '55' }]}>
              <View style={[styles.budgetRingFill, {
                borderColor: '#0f76a8',
                borderLeftColor: 'transparent',
                borderBottomColor: budgetPct > 50 ? '#0f76a8' : 'transparent',
              }]} />
              <View style={styles.budgetRingCenter}>
                <Text style={[styles.budgetPct, { color: ink }]}>{budgetPct}%</Text>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.budgetCardLabel, { color: ink2 }]}>{t('Budget')}</Text>
              <Text style={[styles.budgetCardAmount, { color: ink }]}>
                {currency} {fmtCompact(remaining)}
              </Text>
              <Text style={[styles.budgetCardSub, { color: ink2 }]}>{t('Remaining') ?? 'remaining'}</Text>
              {/* Progress bar */}
              <View style={[styles.budgetBar, { backgroundColor: '#0f76a8' + '22' }]}>
                <View style={[styles.budgetBarFill, { width: `${budgetPct}%` }]} />
              </View>
            </View>
          </View>

          {/* Savings card */}
          <View style={[
            styles.savedCard,
            dark
              ? { backgroundColor: 'rgba(46,204,113,0.18)', borderColor: 'rgba(46,204,113,0.35)' }
              : { backgroundColor: '#14c08a', borderColor: 'transparent' },
          ]}>
            <MaterialCommunityIcons name="piggy-bank-outline" size={22} color={dark ? '#2ecc71' : '#fff'} />
            <Text style={[styles.savedLabel, { color: dark ? '#2ecc71' : 'rgba(255,255,255,0.9)' }]}>
              {t('LabelSaved')}
            </Text>
            {loadingSaved
              ? <Text style={[styles.savedAmount, { color: dark ? '#e6edf3' : '#fff' }]}>—</Text>
              : <Text style={[styles.savedAmount, { color: dark ? '#e6edf3' : '#fff' }]}>
                  {currency} {fmtCompact(totalSaved)}
                </Text>
            }
          </View>
        </View>

        {/* ── Categories ────────────────────────────────────────────────── */}
        {activeCategories.length > 0 && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: ink }]}>{t('ListCategories')}</Text>
              <TouchableOpacity onPress={() => navigation.navigate('CategoryList', { month })}>
                <Text style={styles.viewAll}>{t('ButtonViewAll') ?? 'View all'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.categoryList}>
              {activeCategories.map((cat, idx) => {
                const spent  = cat.expenses.reduce((s, e) => s + e.amount, 0);
                const budget = cat.expenses.reduce((s, e) => s + e.budget, 0);
                const pct    = budget > 0 ? Math.min(spent / budget, 1) : 0;
                const color  = getCategoryColor(idx);
                const trackBg = dark ? color + '30' : color + '22';

                return (
                  <TouchableOpacity
                    key={cat.id}
                    onPress={() => navigation.navigate('ExpenseList', {
                      categoryId: cat.id, categoryName: cat.name, month,
                    })}
                    activeOpacity={0.78}
                  >
                    <View style={[styles.catRow, { backgroundColor: softBg, borderColor: softBorder }]}>
                      {/* Icon circle */}
                      <View style={[styles.catIcon, { backgroundColor: trackBg }]}>
                        <MaterialCommunityIcons name="shape-outline" size={20} color={color} />
                      </View>

                      {/* Info */}
                      <View style={styles.catInfo}>
                        <Text style={[styles.catName, { color: ink }]}>{cat.name}</Text>
                        <Text style={[styles.catSub, { color: ink2 }]}>
                          {cat.expenses.length} {t('items') ?? 'items'} · {Math.round(pct * 100)}%
                        </Text>
                      </View>

                      {/* Amount */}
                      <Text style={[styles.catAmount, { color: '#e74c3c' }]}>
                        {currency} {fmtCompact(spent)}
                      </Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color={ink2} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        {/* Empty state */}
        {activeCategories.length === 0 && !loadingCats && (
          <View style={styles.emptyCategories}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={44} color={ink2} />
            <Text style={[styles.emptyCatText, { color: ink2 }]}>
              {t('LabelNoCategories')}
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container:  { flex: 1 },
  scroll:     { flex: 1 },
  content:    { paddingBottom: 36 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyText:  { textAlign: 'center', fontSize: 15, opacity: 0.7 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 10,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 11 },
  avatar: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: '#0f76a8',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { color: '#fff', fontWeight: '800', fontSize: 18 },
  greeting:    { fontSize: 12.5, fontWeight: '600' },
  projectName: { fontSize: 16, fontWeight: '800' },
  notifBtn: {
    width: 42, height: 42, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginBottom: 12,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },

  // Balance hero card
  heroCard: {
    marginHorizontal: 18,
    marginBottom: 14,
    borderRadius: 28,
    borderWidth: 1,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 12,
  },
  heroLabel:   { fontSize: 13, fontWeight: '600', opacity: 0.85 },
  heroBalance: { fontSize: 42, fontWeight: '800', marginTop: 4, letterSpacing: -1 },
  heroRow: {
    flexDirection: 'row',
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  heroStat:      { flex: 1, gap: 3 },
  heroStatLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, opacity: 0.85 },
  heroStatTitle: { fontSize: 11.5, fontWeight: '600' },
  heroStatAmount:{ fontSize: 17, fontWeight: '700' },
  heroDivider:   { width: 1, marginHorizontal: 18 },

  // Budget + Saved row
  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: 18,
    gap: 12,
    marginBottom: 20,
  },
  budgetCard: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 6,
  },
  budgetRing: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 8,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
    position: 'relative',
  },
  budgetRingFill: {
    position: 'absolute',
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 8,
    borderColor: '#0f76a8',
    borderRightColor: 'transparent',
    borderTopColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  budgetRingCenter: {
    width: 32, height: 32,
    alignItems: 'center', justifyContent: 'center',
  },
  budgetPct:        { fontSize: 12.5, fontWeight: '800' },
  budgetCardLabel:  { fontSize: 12, fontWeight: '600' },
  budgetCardAmount: { fontSize: 15, fontWeight: '800', marginTop: 2 },
  budgetCardSub:    { fontSize: 11 },
  budgetBar: {
    height: 4, borderRadius: 2, marginTop: 6, overflow: 'hidden',
  },
  budgetBarFill: {
    height: 4, borderRadius: 2, backgroundColor: '#0f76a8',
  },

  savedCard: {
    width: 112,
    borderRadius: 22,
    borderWidth: 1,
    padding: 14,
    gap: 4,
    shadowColor: 'rgba(14,159,110,0.28)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 18,
    elevation: 6,
  },
  savedLabel:  { fontSize: 11.5, fontWeight: '600', marginTop: 6 },
  savedAmount: { fontSize: 17, fontWeight: '800' },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 22,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  viewAll:      { fontSize: 12.5, fontWeight: '700', color: '#0f76a8' },

  // Category list
  categoryList: {
    paddingHorizontal: 18,
    gap: 10,
  },
  catRow: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  catIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  catInfo:   { flex: 1, gap: 2 },
  catName:   { fontSize: 14.5, fontWeight: '700' },
  catSub:    { fontSize: 12 },
  catAmount: { fontSize: 14.5, fontWeight: '800' },

  // Empty categories
  emptyCategories: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyCatText: { fontSize: 14, opacity: 0.6 },
});
