import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Card, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProjectStackParamList } from '../../navigation/ProjectStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useCategoriesForMonth } from '../../hooks/useCategories';
import { useIncomesForMonth } from '../../hooks/useIncomes';
import { MonthNavigator } from '../../components/common/MonthNavigator';
import { CategoryCard } from '../../components/budget/CategoryCard';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { currentMonth } from '../../utils/date';
import type { Category } from '../../api/types';

type Props = {
  navigation: NativeStackNavigationProp<ProjectStackParamList, 'MonthlyOverview'>;
};

export const MonthlyOverviewScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth());
  const { selectedProject, currency } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';

  const { data: categories, isLoading: loadingCategories } = useCategoriesForMonth(projectId, month);
  const { data: incomes, isLoading: loadingIncomes } = useIncomesForMonth(projectId, month);

  const totalIncome = incomes?.reduce((sum, i) => sum + i.amount, 0) ?? 0;
  const totalExpenses =
    categories?.reduce(
      (sum, cat) => sum + cat.expenses.reduce((s, e) => s + e.amount, 0),
      0
    ) ?? 0;
  const balance = totalIncome - totalExpenses;

  const activeCategories = categories?.filter((c) => !c.isArchived) ?? [];

  if (loadingCategories || loadingIncomes) return <LoadingIndicator />;

  return (
    <View style={styles.container}>
      <MonthNavigator month={month} onChange={setMonth} />

      <View style={styles.summaryRow}>
        <SummaryCard
          label={t('LabelIncome') ?? 'Income'}
          amount={totalIncome}
          currency={currency}
        />
        <SummaryCard
          label={t('LabelExpenses') ?? 'Expenses'}
          amount={totalExpenses}
          currency={currency}
        />
        <SummaryCard
          label={t('LabelBalance') ?? 'Balance'}
          amount={balance}
          currency={currency}
          highlight={balance < 0 ? 'error' : 'success'}
        />
      </View>

      <FlatList
        data={activeCategories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CategoryCard
            category={item}
            currency={currency}
            onPress={() =>
              navigation.navigate('ExpenseList', {
                categoryId: item.id,
                categoryName: item.name,
                month,
              })
            }
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('LabelNoCategories') ?? 'No categories this month'}</Text>
        }
        contentContainerStyle={styles.list}
      />
    </View>
  );
};

interface SummaryCardProps {
  label: string;
  amount: number;
  currency: string;
  highlight?: 'error' | 'success';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, amount, currency, highlight }) => (
  <Card style={styles.summaryCard}>
    <Card.Content>
      <Text variant="labelSmall" style={styles.summaryLabel}>
        {label}
      </Text>
      <CurrencyDisplay
        amount={amount}
        currency={currency}
        style={
          highlight === 'error'
            ? { ...styles.summaryAmount, ...styles.textError }
            : highlight === 'success'
            ? { ...styles.summaryAmount, ...styles.textSuccess }
            : styles.summaryAmount
        }
      />
    </Card.Content>
  </Card>
);

const styles = StyleSheet.create({
  container: { flex: 1 },
  summaryRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 4,
  },
  summaryCard: { flex: 1 },
  summaryLabel: { opacity: 0.7 },
  summaryAmount: { fontWeight: '700', fontSize: 14, marginTop: 2 },
  textError: { color: '#e74c3c' },
  textSuccess: { color: '#2ecc71' },
  list: { paddingBottom: 80 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.5 },
});
