import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useCategoriesForMonth } from '../../hooks/useCategories';
import { useIncomesForMonth } from '../../hooks/useIncomes';
import { MonthNavigator } from '../../components/common/MonthNavigator';
import { CategoryCard } from '../../components/budget/CategoryCard';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { currentMonth } from '../../utils/date';

type Props = {
  navigation: NativeStackNavigationProp<OverviewStackParamList, 'MonthlyOverview'>;
};

export const MonthlyOverviewScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth());
  const { selectedProject, currency } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';

  const { data: categories, isLoading: loadingCategories } = useCategoriesForMonth(projectId, month);
  const { data: incomes, isLoading: loadingIncomes } = useIncomesForMonth(projectId, month);

  if (!selectedProject) {
    return (
      <View style={styles.emptyState}>
        <Text variant="bodyLarge" style={styles.emptyText}>
          {t('LabelNoProjects')}
        </Text>
      </View>
    );
  }

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
        <SummaryCard label={t('LabelIncome')} amount={totalIncome} currency={currency} />
        <SummaryCard label={t('LabelExpenses')} amount={totalExpenses} currency={currency} />
        <SummaryCard
          label={t('LabelBalance')}
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
          <Text style={styles.empty}>{t('LabelNoCategories')}</Text>
        }
        ListFooterComponent={
          <Button
            mode="outlined"
            icon="cash-plus"
            style={styles.incomesButton}
            onPress={() => navigation.navigate('IncomeList', { month })}
          >
            {t('Incomes')}
          </Button>
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
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  emptyText: { textAlign: 'center', opacity: 0.6 },
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
  list: { paddingBottom: 16 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.5 },
  incomesButton: { marginHorizontal: 16, marginTop: 16, marginBottom: 80 },
});
