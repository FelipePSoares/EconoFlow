import React, { useState } from 'react';
import { FlatList, StyleSheet, View, RefreshControl } from 'react-native';
import { FAB, Text, useTheme, TouchableRipple } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useIncomesForMonth, useDeleteIncome } from '../../hooks/useIncomes';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { CurrencyDisplay } from '../../components/common/CurrencyDisplay';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { MonthNavigator } from '../../components/common/MonthNavigator';
import { currentMonth, fromDateOnly } from '../../utils/date';

type Props = NativeStackScreenProps<OverviewStackParamList, 'IncomeList'>;

export const IncomeListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const theme = useTheme();
  const [month, setMonth] = useState(route.params?.month ?? currentMonth());
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { selectedProject, currency } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';
  const canEdit = selectedProject?.role !== 'Viewer';

  const { data: incomes, isLoading, isError, refetch } = useIncomesForMonth(projectId, month);
  const deleteIncome = useDeleteIncome(projectId, month);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <LoadingIndicator />;

  return (
    <View style={styles.container}>
      <MonthNavigator month={month} onChange={setMonth} />

      {isError && !dismissedError && (
        <ErrorBanner
          visible
          message={t('ErrorGeneric')}
          onDismiss={() => setDismissedError(true)}
        />
      )}

      <FlatList
        data={incomes}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const date = fromDateOnly(item.date);
          const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
          return (
            <TouchableRipple
              onPress={canEdit ? () => navigation.navigate('IncomeForm', {
                incomeId: item.id,
                month,
                initialValues: { name: item.name, amount: item.amount, date: item.date },
              }) : undefined}
              onLongPress={canEdit ? () => setPendingDeleteId(item.id) : undefined}
            >
              <View style={[styles.incomeCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
                <View style={[styles.incomeIcon, { backgroundColor: 'rgba(46, 204, 113, 0.12)' }]}>
                  <MaterialCommunityIcons name="arrow-up-circle" size={20} color="#2ecc71" />
                </View>
                <View style={styles.incomeInfo}>
                  <Text variant="titleSmall" style={{ fontWeight: '600', color: theme.colors.onSurface }}>
                    {item.name}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {dateStr}
                  </Text>
                </View>
                <CurrencyDisplay
                  amount={item.amount}
                  currency={currency}
                  style={[styles.incomeAmount, { color: '#2ecc71' }]}
                />
              </View>
            </TouchableRipple>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('LabelNoIncomes')}</Text>
        }
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
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
  list: { padding: 12, paddingBottom: 80 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.5 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
  incomeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  incomeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  incomeInfo: {
    flex: 1,
    gap: 2,
  },
  incomeAmount: {
    fontWeight: '700',
    fontSize: 15,
  },
});
