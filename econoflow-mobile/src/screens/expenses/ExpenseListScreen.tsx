import React, { useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Divider, FAB, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useExpensesForMonth, useDeleteExpense } from '../../hooks/useExpenses';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { BudgetProgressBar } from '../../components/budget/BudgetProgressBar';
import { fromDateOnly } from '../../utils/date';
import type { Expense, ExpenseItem } from '../../api/types';

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

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
            isExpanded={expandedIds.has(item.id)}
            onToggleExpand={() => toggleExpand(item.id)}
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
          onPress={() => navigation.navigate('ExpenseForm', { categoryId, month })}
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
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

const ExpenseRow: React.FC<ExpenseRowProps> = ({
  expense,
  currency,
  canEdit,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const date = fromDateOnly(expense.date);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const hasItems = expense.expenseItems?.length > 0;
  const showExpand = canEdit || hasItems;

  return (
    <View style={[styles.expenseCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
      <View style={styles.expenseHeader}>
        {showExpand && (
          <TouchableOpacity onPress={onToggleExpand} style={styles.chevron} hitSlop={8}>
            <MaterialCommunityIcons
              name={isExpanded ? 'chevron-down' : 'chevron-right'}
              size={20}
              color={theme.colors.onSurfaceVariant}
            />
          </TouchableOpacity>
        )}
        <View style={styles.expenseMain}>
          <View style={styles.expenseTitleRow}>
            <Text variant="titleSmall" style={styles.expenseName}>
              {expense.name}
            </Text>
            <View style={styles.expenseActions}>
              {canEdit && (
                <>
                  <TouchableOpacity onPress={onEdit} hitSlop={8} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="pencil" size={18} color={theme.colors.onSurfaceVariant} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.actionBtn}>
                    <MaterialCommunityIcons name="delete" size={18} color={theme.colors.error} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
            {dateStr}
          </Text>
          <View style={styles.budgetWrap}>
            <BudgetProgressBar
              spent={expense.amount}
              budget={expense.budget}
              currency={currency}
            />
          </View>
        </View>
      </View>

      {isExpanded && hasItems && (
        <View style={styles.itemsSection}>
          <Divider />
          <Text variant="labelSmall" style={[styles.itemsHeader, { color: theme.colors.onSurfaceVariant }]}>
            {t('LabelExpenseItems')}
          </Text>
          {expense.expenseItems.map((item) => (
            <ExpenseItemRow key={item.id} item={item} currency={currency} theme={theme} />
          ))}
        </View>
      )}
    </View>
  );
};

interface ExpenseItemRowProps {
  item: ExpenseItem;
  currency: string;
  theme: ReturnType<typeof useTheme>;
}

const ExpenseItemRow: React.FC<ExpenseItemRowProps> = ({ item, currency, theme }) => {
  const { t } = useTranslation();
  const date = fromDateOnly(item.date);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <View style={styles.itemRow}>
      <View style={styles.itemLeft}>
        {item.name?.trim() ? (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurface }}>
            {item.name}
          </Text>
        ) : (
          <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, fontStyle: 'italic' }}>
            {t('PlaceholderItemWithoutName') ?? '(no name)'}
          </Text>
        )}
        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
          {dateStr}
        </Text>
      </View>
      <CurrencyDisplay
        amount={item.amount}
        currency={currency}
        style={styles.itemAmount}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { padding: 12, paddingBottom: 80 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.5 },
  fab: { position: 'absolute', right: 16, bottom: 16 },

  expenseCard: {
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    overflow: 'hidden',
  },
  expenseHeader: {
    flexDirection: 'row',
    padding: 12,
    gap: 4,
  },
  chevron: {
    paddingTop: 2,
    paddingRight: 4,
  },
  expenseMain: {
    flex: 1,
    gap: 4,
  },
  expenseTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  expenseName: {
    fontWeight: '600',
    flex: 1,
  },
  expenseActions: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    padding: 4,
  },
  budgetWrap: {
    marginTop: 4,
  },

  itemsSection: {
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  itemsHeader: {
    marginTop: 8,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: 8,
  },
  itemLeft: {
    flex: 1,
    gap: 2,
  },
  itemAmount: {
    fontWeight: '600',
    fontSize: 13,
  },
});
