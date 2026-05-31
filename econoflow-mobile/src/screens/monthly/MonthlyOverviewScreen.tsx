import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, ScrollView, RefreshControl } from 'react-native';
import { Text, ProgressBar } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
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
import { BudgetProgressBar } from '../../components/budget/BudgetProgressBar';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { currentMonth } from '../../utils/date';
import { calculateTotalBudget, calculateTotalExpenses, calculateTotalIncome } from '../../utils/budget';
import { useAppTheme } from '../../theme/useAppTheme';

type Props = {
  navigation: NativeStackNavigationProp<OverviewStackParamList, 'MonthlyOverview'>;
};

export const MonthlyOverviewScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const theme = useAppTheme();
  const [month, setMonth] = useState(currentMonth());
  const [refreshing, setRefreshing] = useState(false);

  const { user } = useAuthStore();
  const { selectedProject, currency, setSelectedProject } = useProjectStore();
  const { data: projects } = useProjects();
  const projectId = selectedProject?.project.id ?? '';

  const { data: categories, isLoading: loadingCategories, isError: catsError, refetch: refetchCats } = useCategoriesForMonth(projectId, month);
  const { data: incomes, isLoading: loadingIncomes, isError: incError, refetch: refetchIncs } = useIncomesForMonth(projectId, month);
  const { totalSaved, isLoading: loadingSaved } = useTotalSavedForMonth(projectId, month);

  // Auto-select default project
  useEffect(() => {
    if (selectedProject || !projects?.length) return;
    const pick =
      (user?.defaultProjectId
        ? projects.find((p) => p.project.id === user.defaultProjectId)
        : null) ?? projects[0];
    if (pick) setSelectedProject(pick);
  }, [projects, selectedProject, user, setSelectedProject]);

  useEffect(() => {
    navigation.setOptions({
      title: selectedProject?.project.name ?? t('TabOverview'),
    });
  }, [selectedProject, navigation, t]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchCats(), refetchIncs()]);
    setRefreshing(false);
  };

  if (!selectedProject) {
    return (
      <View style={styles.emptyState}>
        <Text variant="bodyLarge" style={styles.emptyText}>
          {t('LabelNoProjects')}
        </Text>
      </View>
    );
  }

  if (loadingCategories || loadingIncomes) return <LoadingIndicator />;

  const totalIncome = calculateTotalIncome(incomes ?? []);
  const totalExpenses = calculateTotalExpenses(categories ?? []);
  const totalBudget = calculateTotalBudget(categories ?? []);
  const balance = totalIncome - totalExpenses;

  const activeCategories = categories?.filter((c) => !c.isArchived) ?? [];
  const topCategories = activeCategories.slice(0, 4);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Hero header */}
      <LinearGradient
        colors={['#061e33', '#0c3350', '#0f4a6a']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <Text variant="labelMedium" style={styles.heroProjectLabel}>
            {selectedProject.project.name}
          </Text>
          <Text variant="labelSmall" style={styles.heroCurrency}>
            {currency}
          </Text>
        </View>
        <MonthNavigator month={month} onChange={setMonth} light />
        <CurrencyDisplay
          amount={balance}
          currency={currency}
          style={styles.heroBalance}
        />
        <Text variant="bodySmall" style={styles.heroSubtitle}>
          {t('LabelBalance')}
        </Text>
      </LinearGradient>

      {/* Error banners */}
      {(catsError || incError) && (
        <View style={[styles.errorBanner, { backgroundColor: theme.colors.errorContainer }]}>
          <MaterialCommunityIcons name="alert-circle" size={16} color={theme.colors.error} />
          <Text variant="bodySmall" style={{ color: theme.colors.error, marginLeft: 8 }}>
            {t('ErrorGeneric')}
          </Text>
        </View>
      )}

      {/* Summary cards row */}
      <View style={styles.summaryRow}>
        <TouchableOpacity
          style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}
          onPress={() => navigation.navigate('IncomeList', { month })}
          activeOpacity={0.7}
        >
          <View style={[styles.summaryCardAccent, { backgroundColor: theme.colors.tertiary }]} />
          <View style={styles.summaryCardBody}>
            <View style={styles.summaryCardHeader}>
              <MaterialCommunityIcons name="arrow-up-circle" size={16} color={theme.colors.tertiary} />
              <Text variant="labelSmall" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                {t('LabelIncome')}
              </Text>
            </View>
            <CurrencyDisplay
              amount={totalIncome}
              currency={currency}
              style={[styles.summaryAmount, { color: theme.colors.tertiary }]}
            />
          </View>
        </TouchableOpacity>

        <View style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.summaryCardAccent, { backgroundColor: theme.colors.primary }]} />
          <View style={styles.summaryCardBody}>
            <View style={styles.summaryCardHeader}>
              <MaterialCommunityIcons name="piggy-bank" size={16} color={theme.colors.primary} />
              <Text variant="labelSmall" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                {t('LabelSaved')}
              </Text>
            </View>
            {loadingSaved ? (
              <Text style={[styles.summaryAmount, { color: theme.colors.primary }]}>—</Text>
            ) : (
              <CurrencyDisplay
                amount={totalSaved}
                currency={currency}
                style={[styles.summaryAmount, { color: totalSaved >= 0 ? theme.colors.primary : theme.colors.error }]}
              />
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.summaryCard, { backgroundColor: theme.colors.surface }]}
          onPress={() => navigation.navigate('CategoryList', { month })}
          activeOpacity={0.7}
        >
          <View style={[styles.summaryCardAccent, { backgroundColor: theme.customColors.expense }]} />
          <View style={styles.summaryCardBody}>
            <View style={styles.summaryCardHeader}>
              <MaterialCommunityIcons name="arrow-down-circle" size={16} color={theme.customColors.expense} />
              <Text variant="labelSmall" style={[styles.summaryLabel, { color: theme.colors.onSurfaceVariant }]}>
                {t('LabelExpenses')}
              </Text>
            </View>
            <CurrencyDisplay
              amount={totalExpenses}
              currency={currency}
              style={[styles.summaryAmount, { color: theme.customColors.expense }]}
            />
          </View>
        </TouchableOpacity>
      </View>

      {/* Budget progress */}
      <View style={[styles.budgetSection, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.budgetSectionHeader}>
          <MaterialCommunityIcons name="chart-pie" size={18} color={theme.colors.primary} />
          <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
            {t('Budget')}
          </Text>
        </View>
        <BudgetProgressBar
          spent={totalExpenses}
          budget={totalBudget}
          currency={currency}
        />
      </View>

      {/* Quick category summary */}
      {topCategories.length > 0 && (
        <View style={[styles.categoriesSection, { backgroundColor: theme.colors.surface }]}>
          <View style={styles.categoriesSectionHeader}>
            <View style={styles.categoriesSectionHeaderLeft}>
              <MaterialCommunityIcons name="shape" size={18} color={theme.colors.primary} />
              <Text variant="titleSmall" style={{ color: theme.colors.onSurface, fontWeight: '600' }}>
                {t('ListCategories')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('CategoryList', { month })}>
              <Text variant="labelSmall" style={{ color: theme.colors.primary }}>
                {t('ButtonViewAll') ?? 'View all'}
              </Text>
            </TouchableOpacity>
          </View>
          {topCategories.map((cat) => {
            const catSpent = cat.expenses.reduce((s, e) => s + e.amount, 0);
            const catBudget = cat.expenses.reduce((s, e) => s + e.budget, 0);
            const catProgress = catBudget > 0 ? Math.min(catSpent / catBudget, 1) : 0;
            return (
              <TouchableOpacity
                key={cat.id}
                style={styles.categoryRow}
                onPress={() =>
                  navigation.navigate('ExpenseList', {
                    categoryId: cat.id,
                    categoryName: cat.name,
                    month,
                  })
                }
                activeOpacity={0.7}
              >
                <View style={styles.categoryRowInfo}>
                  <Text variant="bodyMedium" style={{ color: theme.colors.onSurface, fontWeight: '500' }}>
                    {cat.name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    <CurrencyDisplay amount={catSpent} currency={currency} /> / <CurrencyDisplay amount={catBudget} currency={currency} />
                  </Text>
                </View>
                <View style={styles.categoryRowProgress}>
                  <ProgressBar
                    progress={catProgress}
                    color={catProgress >= 1 ? theme.colors.error : catProgress >= 0.7 ? theme.customColors.warning : theme.colors.primary}
                    style={styles.categoryBar}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 32 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { textAlign: 'center', opacity: 0.6 },

  // Hero
  hero: {
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  heroProjectLabel: {
    color: 'rgba(235,247,255,0.8)',
    fontWeight: '600',
  },
  heroCurrency: {
    color: 'rgba(235,247,255,0.6)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  heroBalance: {
    fontSize: 32,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 38,
  },
  heroSubtitle: {
    color: 'rgba(235,247,255,0.7)',
    marginTop: 2,
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 10,
    borderRadius: 8,
  },

  // Summary cards
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  summaryCardAccent: {
    height: 3,
  },
  summaryCardBody: {
    padding: 10,
    gap: 4,
  },
  summaryCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryLabel: {
    letterSpacing: 0.3,
  },
  summaryAmount: {
    fontWeight: '700',
    fontSize: 15,
  },

  // Budget section
  budgetSection: {
    marginHorizontal: 12,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  budgetSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },

  // Categories
  categoriesSection: {
    marginHorizontal: 12,
    borderRadius: 12,
    padding: 14,
    elevation: 2,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  categoriesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoriesSectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  categoryRowInfo: {
    flex: 1,
    gap: 2,
  },
  categoryRowProgress: {
    width: 80,
    marginLeft: 12,
  },
  categoryBar: {
    height: 6,
    borderRadius: 3,
  },
});
