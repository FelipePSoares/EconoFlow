import React, { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { MD3Theme, Text, useTheme } from 'react-native-paper';
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

type Props = {
  navigation: NativeStackNavigationProp<OverviewStackParamList, 'MonthlyOverview'>;
};

export const MonthlyOverviewScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const theme = useTheme<MD3Theme>();
  const [month, setMonth] = useState(currentMonth());

  const { user } = useAuthStore();
  const { selectedProject, currency, setSelectedProject } = useProjectStore();
  const { data: projects } = useProjects();
  const projectId = selectedProject?.project.id ?? '';

  const { data: categories, isLoading: loadingCategories } = useCategoriesForMonth(projectId, month);
  const { data: incomes, isLoading: loadingIncomes } = useIncomesForMonth(projectId, month);
  const { totalSaved, isLoading: loadingSaved } = useTotalSavedForMonth(projectId, month);

  // Auto-select default project when none is selected
  useEffect(() => {
    if (selectedProject || !projects?.length) return;
    const pick =
      (user?.defaultProjectId
        ? projects.find((p) => p.project.id === user.defaultProjectId)
        : null) ?? projects[0];
    if (pick) setSelectedProject(pick);
  }, [projects, selectedProject, user, setSelectedProject]);

  // Update header title to show project name
  useEffect(() => {
    navigation.setOptions({
      title: selectedProject?.project.name ?? t('TabOverview'),
    });
  }, [selectedProject, navigation, t]);

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

  const cardBg = theme.colors.surface;
  const cardBorder = theme.colors.outline;

  return (
    <View style={styles.container}>
      <MonthNavigator month={month} onChange={setMonth} />

      <View style={styles.summaryRow}>
        <TouchableOpacity
          style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={() => navigation.navigate('IncomeList', { month })}
          activeOpacity={0.7}
        >
          <Text variant="labelSmall" style={styles.summaryLabel}>
            {t('LabelIncome')}
          </Text>
          <CurrencyDisplay
            amount={totalIncome}
            currency={currency}
            style={[styles.summaryAmount, styles.textSuccess]}
          />
        </TouchableOpacity>

        <View style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text variant="labelSmall" style={styles.summaryLabel}>
            {t('LabelSaved')}
          </Text>
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

        <TouchableOpacity
          style={[styles.summaryCard, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={() => navigation.navigate('CategoryList', { month })}
          activeOpacity={0.7}
        >
          <Text variant="labelSmall" style={styles.summaryLabel}>
            {t('LabelExpenses')}
          </Text>
          <CurrencyDisplay
            amount={totalExpenses}
            currency={currency}
            style={[styles.summaryAmount, styles.textError]}
          />
        </TouchableOpacity>
      </View>

      <View style={[styles.budgetSection, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <BudgetProgressBar
          spent={totalExpenses}
          budget={totalBudget}
          currency={currency}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { textAlign: 'center', opacity: 0.6 },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    padding: 10,
    gap: 4,
  },
  summaryLabel: { opacity: 0.7 },
  summaryAmount: { fontWeight: '700', fontSize: 14, marginTop: 2 },
  textError: { color: '#e74c3c' },
  textSuccess: { color: '#2ecc71' },
  budgetSection: {
    marginHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
  },
});
