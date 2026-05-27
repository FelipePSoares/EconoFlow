import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { FAB, List, Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useIncomesForMonth, useDeleteIncome } from '../../hooks/useIncomes';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { MonthNavigator } from '../../components/common/MonthNavigator';
import { currentMonth, fromDateOnly } from '../../utils/date';

type Props = NativeStackScreenProps<OverviewStackParamList, 'IncomeList'>;

export const IncomeListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const [month, setMonth] = useState(route.params?.month ?? currentMonth());
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
              onPress={canEdit ? () => navigation.navigate('IncomeForm', {
                incomeId: item.id,
                month,
                initialValues: { name: item.name, amount: item.amount, date: item.date },
              }) : undefined}
              onLongPress={canEdit ? () => setPendingDeleteId(item.id) : undefined}
            />
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('LabelNoIncomes')}</Text>
        }
        contentContainerStyle={styles.list}
      />

      {canEdit && (
        <FAB
          icon="plus"
          style={styles.fab}
          onPress={() => navigation.navigate('IncomeForm', { month })}
        />
      )}

      <ConfirmDialog
        visible={!!pendingDeleteId}
        title={t('LabelDeleteIncome')}
        message={t('LabelConfirmDeleteIncome')}
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
  amount: { alignSelf: 'center', fontWeight: '600' },
});
