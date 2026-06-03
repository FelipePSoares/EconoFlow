import React, { useState, useCallback } from 'react';
import {
  StyleSheet, TouchableOpacity, View,
  ScrollView, RefreshControl,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useQuickAddStore } from '../../store/quickAddStore';
import { useIncomesForMonth, useDeleteIncome } from '../../hooks/useIncomes';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { QuickAddModal } from '../quick-add/QuickAddModal';
import type { QuickAddEditMode } from '../quick-add/QuickAddModal';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { getCurrencySymbol } from '../../utils/currency';
import { getCategoryIcon } from '../../utils/categoryIcon';
import { fromDateOnly, formatMonthLabel } from '../../utils/date';

type Props = NativeStackScreenProps<OverviewStackParamList, 'IncomeList'>;

function fmt(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString('pt-BR');
}

interface EditState {
  visible: boolean;
  editMode?: QuickAddEditMode;
}

export const IncomeListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const insets = useSafeAreaInsets();

  const month = route.params.month;

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [dismissedError, setDismissedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editState, setEditState] = useState<EditState>({ visible: false });

  const { selectedProject, currency } = useProjectStore();
  const sym = getCurrencySymbol(currency);
  const projectId = selectedProject?.project.id ?? '';
  const canEdit = selectedProject?.role !== 'Viewer';

  const setDefaultType = useQuickAddStore(s => s.setDefaultType);
  useFocusEffect(
    useCallback(() => {
      setDefaultType('income');
      return () => setDefaultType(null);
    }, [setDefaultType])
  );

  const { data: incomes, isLoading, isError, refetch } = useIncomesForMonth(projectId, month);
  const deleteIncome = useDeleteIncome(projectId, month);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <LoadingIndicator />;

  const list = incomes ?? [];
  const totalIncome = list.reduce((s, i) => s + i.amount, 0);

  return (
    <GlassScreen dark={dark}>
      {/* ── Custom header ─────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBtn, { borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)' }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={ink} />
        </TouchableOpacity>

        <View style={styles.headerTitle}>
          <Text style={[styles.headerName, { color: ink }]}>{t('Incomes') ?? 'Incomes'}</Text>
          <Text style={[styles.headerMonth, { color: ink2 }]}>{formatMonthLabel(month)}</Text>
        </View>

        {/* Spacer to keep title centred (same width as back button) */}
        <View style={styles.headerBtn} />
      </View>

      {isError && !dismissedError && (
        <ErrorBanner
          visible
          message={t('ErrorGeneric')}
          onDismiss={() => setDismissedError(true)}
        />
      )}

      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink2} />
        }
      >
        {/* ── Summary card ──────────────────────────────────────────── */}
        <GlassCard dark={dark} radius={26} style={styles.summaryCard}>
          <View style={styles.summaryInner}>
            <View style={styles.summaryIconWrap}>
              <MaterialCommunityIcons name="arrow-up-circle" size={32} color="#2ecc71" />
            </View>
            <View style={styles.summaryMeta}>
              <Text style={[styles.summaryMonthLabel, { color: ink2 }]}>
                {t('Incomes') ?? 'Incomes'} · {formatMonthLabel(month)}
              </Text>
              <Text style={[styles.summaryAmt, { color: ink }]}>
                {sym} {fmt(totalIncome)}
              </Text>
            </View>
          </View>
        </GlassCard>

        {/* ── Section header ────────────────────────────────────────── */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: ink }]}>
            {t('Incomes') ?? 'Incomes'}
          </Text>
          <Text style={[styles.sectionCount, { color: ink2 }]}>
            {list.length} {t('LabelExpenseItems') ?? 'items'}
          </Text>
        </View>

        {/* ── Income rows ───────────────────────────────────────────── */}
        {list.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="cash-plus" size={44} color={ink2} />
            <Text style={[styles.emptyText, { color: ink2 }]}>
              {t('LabelNoIncomes') ?? 'No income this month'}
            </Text>
          </View>
        ) : (
          <View style={styles.groupList}>
            {list.map((item) => {
              const dateStr = fromDateOnly(item.date)
                .toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const icon = getCategoryIcon(item.name);
              return (
                <GlassCard key={item.id} dark={dark} radius={18} style={styles.groupCard}>
                  <View style={styles.groupHeader}>
                    <View style={[styles.groupIcon, { backgroundColor: '#2ecc7122' }]}>
                      <MaterialCommunityIcons name={icon as never} size={20} color="#2ecc71" />
                    </View>

                    <View style={styles.groupInfo}>
                      <Text style={[styles.groupName, { color: ink }]}>{item.name}</Text>
                      <Text style={[styles.groupSub, { color: ink2 }]}>{dateStr}</Text>
                    </View>

                    <Text style={[styles.groupAmt, { color: '#2ecc71' }]}>
                      +{sym} {fmt(item.amount)}
                    </Text>

                    {canEdit && (
                      <>
                        <TouchableOpacity
                          onPress={() => setEditState({
                            visible: true,
                            editMode: {
                              type: 'income',
                              id: item.id,
                              initialValues: {
                                name: item.name,
                                amount: item.amount,
                                date: item.date,
                              },
                            },
                          })}
                          hitSlop={6}
                          style={styles.groupAction}
                        >
                          <MaterialCommunityIcons name="pencil-outline" size={16} color={ink2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setPendingDeleteId(item.id)}
                          hitSlop={6}
                          style={styles.groupAction}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#e74c3c" />
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </GlassCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={!!pendingDeleteId}
        title={t('LabelDeleteIncome') ?? 'Delete income'}
        message={t('LabelConfirmDeleteIncome') ?? 'Are you sure you want to delete this income?'}
        onConfirm={() => {
          if (!pendingDeleteId) return;
          deleteIncome.mutate(pendingDeleteId, {
            onSuccess: () => setPendingDeleteId(null),
          });
        }}
        onCancel={() => setPendingDeleteId(null)}
      />

      <QuickAddModal
        visible={editState.visible}
        onClose={() => setEditState({ visible: false })}
        month={month}
        editMode={editState.editMode}
      />
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 12,
  },
  headerBtn: {
    width: 42, height: 42, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    borderColor: 'transparent',
  },
  headerTitle: { flex: 1, alignItems: 'center' },
  headerName:  { fontSize: 16, fontWeight: '800' },
  headerMonth: { fontSize: 11.5, fontWeight: '600' },

  summaryCard:  { marginHorizontal: 18, marginBottom: 16 },
  summaryInner: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18 },
  summaryIconWrap: {
    width: 56, height: 56, borderRadius: 18,
    backgroundColor: '#2ecc7126',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  summaryMeta:       { flex: 1 },
  summaryMonthLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  summaryAmt:        { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },

  sectionHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  sectionCount: { fontSize: 12.5, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, opacity: 0.6 },

  groupList:   { paddingHorizontal: 18, gap: 10 },
  groupCard:   {},
  groupHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  groupIcon: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  groupInfo:   { flex: 1, gap: 2, minWidth: 0 },
  groupName:   { fontSize: 14, fontWeight: '700' },
  groupSub:    { fontSize: 11.5 },
  groupAmt:    { fontSize: 13.5, fontWeight: '800' },
  groupAction: { padding: 4 },
});
