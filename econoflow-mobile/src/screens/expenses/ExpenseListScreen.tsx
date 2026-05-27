import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, List, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useExpensesForMonth, useDeleteExpense } from '../../hooks/useExpenses';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { fromDateOnly } from '../../utils/date';
import type { Expense } from '../../api/types';

type Props = NativeStackScreenProps<OverviewStackParamList, 'ExpenseList'>;

export const ExpenseListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { categoryId, month } = route.params;
  const { selectedProject, currency } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';
  const canEdit = selectedProject?.role !== 'Viewer';

  const { data: expenses, isLoading } = useExpensesForMonth(projectId, categoryId, month);
  const deleteExpense = useDeleteExpense(projectId, categoryId, month);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    deleteExpense.mutate(pendingDeleteId, {
      onSuccess: () => setPendingDeleteId(null),
    });
  };

  if (isLoading) return <LoadingIndicator />;

  return (
    <View style={styles.container}>
      <FlatList
        data={expenses}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ExpenseRow
            expense={item}
            currency={currency}
            canEdit={canEdit}
            onEdit={() =>
              navigation.navigate('ExpenseForm', {
                categoryId,
                month,
                expenseId: item.id,
                initialValues: {
                  name: item.name,
                  amount: item.amount,
                  budget: item.budget,
                  date: item.date,
                  isDeductible: item.isDeductible,
                },
              })
            }
            onDelete={() => setPendingDeleteId(item.id)}
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('LabelNoExpenses') ?? 'No expenses this month'}</Text>
        }
        contentContainerStyle={styles.list}
      />

      {canEdit && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() =>
            navigation.navigate('ExpenseForm', { categoryId, month })
          }
        />
      )}

      <ConfirmDialog
        visible={!!pendingDeleteId}
        title={t('LabelDeleteExpense') ?? 'Delete expense'}
        message={t('LabelConfirmDeleteExpense') ?? 'Are you sure you want to delete this expense?'}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </View>
  );
};

interface ExpenseRowProps {
  expense: Expense;
  currency: string;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

const ExpenseRow: React.FC<ExpenseRowProps> = ({ expense, currency, canEdit, onEdit, onDelete }) => {
  const date = fromDateOnly(expense.date);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <List.Item
      title={expense.name}
      description={dateStr}
      right={() => <CurrencyDisplay amount={expense.amount} currency={currency} style={styles.amount} />}
      onPress={canEdit ? onEdit : undefined}
      onLongPress={canEdit ? onDelete : undefined}
    />
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 80 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.5 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  amount: { alignSelf: 'center', fontWeight: '600' },
});
