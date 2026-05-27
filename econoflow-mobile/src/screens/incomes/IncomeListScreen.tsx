import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, List, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useIncomesForMonth, useDeleteIncome } from '../../hooks/useIncomes';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { MonthNavigator } from '../../components/common/MonthNavigator';
import { currentMonth, fromDateOnly } from '../../utils/date';
import type { Income } from '../../api/types';

type Props = {
  navigation: BottomTabNavigationProp<MainTabParamList, 'Incomes'>;
};

export const IncomeListScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [month, setMonth] = useState(currentMonth());
  const [showForm, setShowForm] = useState(false);
  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const { selectedProject, currency } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';
  const canEdit = selectedProject?.role !== 'Viewer';

  const { data: incomes, isLoading } = useIncomesForMonth(projectId, month);
  const deleteIncome = useDeleteIncome(projectId, month);

  if (isLoading) return <LoadingIndicator />;

  return (
    <View style={styles.container}>
      <MonthNavigator month={month} onChange={setMonth} />

      <FlatList
        data={incomes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const date = fromDateOnly(item.date);
          const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return (
            <List.Item
              title={item.name}
              description={dateStr}
              right={() => (
                <CurrencyDisplay amount={item.amount} currency={currency} style={styles.amount} />
              )}
              onPress={canEdit ? () => setEditingIncome(item) : undefined}
              onLongPress={canEdit ? () => setPendingDeleteId(item.id) : undefined}
            />
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('LabelNoIncomes') ?? 'No income this month'}</Text>
        }
        contentContainerStyle={styles.list}
      />

      {canEdit && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => {
            setEditingIncome(null);
            setShowForm(true);
          }}
        />
      )}

      <ConfirmDialog
        visible={!!pendingDeleteId}
        title={t('LabelDeleteIncome') ?? 'Delete income'}
        message={t('LabelConfirmDeleteIncome') ?? 'Are you sure?'}
        onConfirm={() => {
          if (pendingDeleteId) deleteIncome.mutate(pendingDeleteId);
          setPendingDeleteId(null);
        }}
        onCancel={() => setPendingDeleteId(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 80 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.5 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  amount: { alignSelf: 'center', fontWeight: '600', color: '#2ecc71' },
});
