import React, { useState, useCallback, useEffect } from 'react';
import {
  StyleSheet, TouchableOpacity, View,
  ScrollView, RefreshControl,
} from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import {
  useExpensesForMonth, useDeleteExpense, useDeleteExpenseItem,
  useRestoreExpense, useRestoreExpenseItem,
} from '../../hooks/useExpenses';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { SwipeableRow } from '../../components/common/SwipeableRow';
import { UndoToast } from '../../components/common/UndoToast';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { DonutRing } from '../../components/common/DonutRing';
import { QuickAddModal } from '../quick-add/QuickAddModal';
import type { QuickAddEditMode } from '../quick-add/QuickAddModal';
import { fromDateOnly, formatMonthLabel } from '../../utils/date';
import { MonthNavigator } from '../../components/common/MonthNavigator';
import { toggleSetItem, calculateExpensesOverspend } from '../../utils/budget';
import { getCategoryColor } from '../../utils/categoryTheme';
import { getCategoryIcon } from '../../utils/categoryIcon';
import { getCurrencySymbol } from '../../utils/currency';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';
import { captureError } from '../../monitoring/sentry';
import { useQuickAddStore } from '../../store/quickAddStore';
import { formatAmount } from '../../utils/format';
import type { TFunction } from 'i18next';
import type { Expense, ExpenseItem } from '../../api/types';

type Props = NativeStackScreenProps<OverviewStackParamList, 'ExpenseList'>;

interface QuickAddState {
  visible: boolean;
  defaultExpenseId?: string;
  editMode?: QuickAddEditMode;
}

export const ExpenseListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2, hair } = useAuroraSkin();
  const { colors, customColors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const fmt = (n: number) => formatAmount(n, i18n.language);

  const { categoryId, categoryName, month: initialMonth, categoryIndex = 0 } = route.params;
  const [month, setMonth] = useState(initialMonth);
  const color = getCategoryColor(categoryIndex);

  const { selectedProject, currency } = useProjectStore();
  const sym = getCurrencySymbol(currency);
  const projectId = selectedProject?.project.id ?? '';
  const canEdit = selectedProject?.role !== 'Viewer';

  // Publish current category and month to the global FAB so it can pre-select them
  const setQuickAddCategoryId = useQuickAddStore(s => s.setCategoryId);
  const setViewedMonth = useQuickAddStore(s => s.setViewedMonth);
  useFocusEffect(
    useCallback(() => {
      setQuickAddCategoryId(categoryId);
      return () => setQuickAddCategoryId(null);
    }, [categoryId, setQuickAddCategoryId])
  );
  const isFocused = useIsFocused();
  useEffect(() => {
    setViewedMonth(isFocused ? month : null);
  }, [month, isFocused, setViewedMonth]);

  const { data: expenses, isLoading, isFetching, refetch, error: expensesError } =
    useExpensesForMonth(projectId, categoryId, month);
  const deleteExpense      = useDeleteExpense(projectId, categoryId, month);
  const deleteExpenseItem  = useDeleteExpenseItem(projectId, categoryId, month);
  const restoreExpense     = useRestoreExpense(projectId, categoryId, month);
  const restoreExpenseItem = useRestoreExpenseItem(projectId, categoryId, month);

  useEffect(() => {
    if (expensesError) captureError(expensesError, { screen: 'ExpenseListScreen', action: 'fetchExpenses' });
  }, [expensesError]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [quickAdd, setQuickAdd] = useState<QuickAddState>({ visible: false });
  const [undoState, setUndoState] = useState<{ visible: boolean; expenseId: string | null; itemId: string | null }>({ visible: false, expenseId: null, itemId: null });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading && !expenses) return <LoadingIndicator />;

  const list = expenses ?? [];
  const totalSpent     = list.reduce((s, e) => s + e.amount, 0);
  const totalBudget    = list.reduce((s, e) => s + e.budget, 0);
  const totalOverspend = calculateExpensesOverspend(list);
  const pct = totalBudget > 0 ? totalSpent / totalBudget : 0;

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
          <Text style={[styles.headerName, { color: ink }]}>{categoryName}</Text>
          <Text style={[styles.headerMonth, { color: ink2 }]}>{formatMonthLabel(month)}</Text>
        </View>

        {/* Spacer to keep title centred (same width as back button) */}
        <View style={styles.headerBtn} />
      </View>

      <MonthNavigator month={month} onChange={setMonth} dark={dark} />

      <ScrollView
        style={[styles.fill, { opacity: isFetching && !!expenses ? 0.55 : 1 }]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink2} />
        }
      >
        {/* ── Summary card ─────────────────────────────────────────────── */}
        <GlassCard dark={dark} radius={26} style={styles.summaryCard}>
          <View style={styles.summaryInner}>
            <DonutRing
              size={72}
              strokeWidth={8}
              progress={pct}
              color={pct > 1 ? colors.error : color}
              trackColor={color + '33'}
            >
              <MaterialCommunityIcons name={getCategoryIcon(categoryName) as never} size={24} color={pct > 1 ? colors.error : color} />
            </DonutRing>

            <View style={styles.summaryMeta}>
              <Text style={[styles.summaryMonthLabel, { color: ink2 }]}>
                {t('LabelExpenses') ?? 'Expenses'} · {formatMonthLabel(month)}
              </Text>
              <Text style={[styles.summaryAmt, { color: ink }]}>
                {sym} {fmt(totalSpent)}
              </Text>
              {totalBudget > 0 && (
                <Text style={[styles.summaryBudget, { color: pct > 1 ? colors.error : ink2 }]}>
                  {t('Budget') ?? 'Budget'} {sym} {fmt(totalBudget)} · {Math.round(pct * 100)}%
                  {totalOverspend > 0 ? ` · ${fmt(totalOverspend)} ${t('LabelOver') ?? 'over'}` : ''}
                </Text>
              )}
              <View style={[styles.summaryBar, { backgroundColor: color + '22' }]}>
                <View style={[
                  styles.summaryBarFill,
                  { width: `${Math.min(Math.round(pct * 100), 100)}%` as `${number}%`, backgroundColor: pct > 1 ? colors.error : color },
                ]} />
              </View>
            </View>
          </View>
        </GlassCard>

        {/* ── Section header ────────────────────────────────────────────── */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: ink }]}>
            {t('ListExpenses') ?? 'Expenses'}
          </Text>
          <Text style={[styles.sectionCount, { color: ink2 }]}>
            {list.length} {t('LabelExpenseItems') ?? 'items'}
          </Text>
        </View>

        {/* ── Expense list ─────────────────────────────────────────────── */}
        {list.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons name="script-text-outline" size={44} color={ink2} />
            <Text style={[styles.emptyText, { color: ink2 }]}>
              {t('LabelNoExpenses') ?? 'No expenses this month'}
            </Text>
          </View>
        ) : (
          <View style={styles.groupList}>
            {list.map((expense) => {
              const isOpen      = expandedIds.has(expense.id);
              const expIcon     = getCategoryIcon(expense.name);
              const expOverspend = calculateExpensesOverspend([expense]);
              const isExpOver   = expOverspend > 0;
              return (
                <GlassCard key={expense.id} dark={dark} radius={18} style={styles.groupCard}>
                  {isExpOver && (
                    <View style={[styles.overspendAccent, { backgroundColor: colors.error }]} />
                  )}
                  <SwipeableRow
                    disabled={!canEdit}
                    actionIcon="trash-can-outline"
                    actionColor={customColors.expense}
                    onAction={() => {
                      deleteExpense.mutate(expense.id, {
                        onError: (err) => captureError(err, { screen: 'ExpenseListScreen', action: 'deleteExpense' }),
                      });
                      setUndoState({ visible: true, expenseId: expense.id, itemId: null });
                    }}
                  >
                  {/* ── Group header ──────────────────────────────────── */}
                  <TouchableOpacity
                    testID={`expand-${expense.id}`}
                    onPress={() => setExpandedIds(prev => toggleSetItem(prev, expense.id))}
                    activeOpacity={0.75}
                    style={styles.groupHeader}
                  >
                    <View style={[styles.groupIcon, { backgroundColor: color + (dark ? '33' : '22') }]}>
                      <MaterialCommunityIcons name={expIcon as never} size={20} color={color} />
                    </View>

                    <View style={styles.groupInfo}>
                      <Text style={[styles.groupName, { color: ink }]}>{expense.name}</Text>
                      <View style={styles.groupSubRow}>
                        <Text style={[styles.groupSub, { color: ink2 }]}>
                          {expense.items?.length > 0
                            ? `${expense.items.length} ${t('LabelExpenseItems') ?? 'items'}`
                            : fromDateOnly(expense.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </Text>
                        {expense.isDeductible && (
                          <View style={[styles.deductBadge, { backgroundColor: colors.primary + '26' }]}>
                            <Text style={[styles.deductBadgeText, { color: colors.primary }]}>
                              {t('LabelDeductible') ?? 'Deductible'}
                            </Text>
                          </View>
                        )}
                        {(expense.attachments?.length ?? 0) > 0 && (
                          <View style={[styles.proofBadge, { backgroundColor: ink2 + '22' }]}>
                            <MaterialCommunityIcons name="paperclip" size={9} color={ink2} />
                            <Text style={[styles.proofBadgeText, { color: ink2 }]}>
                              {t('LabelProofAttached') ?? 'Proof'}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    <View style={styles.groupAmtCol}>
                      <Text style={[styles.groupAmt, { color: isExpOver ? colors.error : customColors.expense }]}>
                        −{sym} {fmt(expense.amount)}
                      </Text>
                      {expense.budget > 0 && (
                        <Text style={[styles.groupBudget, { color: isExpOver ? colors.error : ink2 }]}>
                          {isExpOver
                            ? `+${sym} ${fmt(expOverspend)} ${t('LabelOver') ?? 'over'}`
                            : `${t('Of') ?? 'of'} ${sym} ${fmt(expense.budget)}`}
                        </Text>
                      )}
                    </View>

                    {canEdit && (
                      <TouchableOpacity
                          onPress={() => setQuickAdd({
                            visible: true,
                            editMode: {
                              type: 'expense',
                              id: expense.id,
                              categoryId,
                              hasItems: (expense.items?.length ?? 0) > 0,
                              initialValues: {
                                name: expense.name,
                                amount: expense.amount,
                                date: expense.date,
                                isDeductible: expense.isDeductible,
                                budget: expense.budget,
                              },
                            },
                          })}
                          hitSlop={6}
                          style={styles.groupAction}
                        >
                          <MaterialCommunityIcons name="pencil-outline" size={16} color={ink2} />
                        </TouchableOpacity>
                    )}

                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={ink2}
                      style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>

                  </SwipeableRow>
                  {/* ── Expanded items ────────────────────────────────── */}
                  {isOpen && (
                    <ExpenseItemsSection
                      expense={expense}
                      currency={sym}
                      color={color}
                      dark={dark}
                      ink={ink}
                      ink2={ink2}
                      hair={hair}
                      canEdit={canEdit}
                      t={t}
                      onAddItemPressed={() => setQuickAdd({
                        visible: true,
                        defaultExpenseId: expense.id,
                      })}
                      onDeleteItem={(expenseItemId) => {
                        deleteExpenseItem.mutate(
                          { expenseId: expense.id, expenseItemId },
                          { onError: (err) => captureError(err, { screen: 'ExpenseListScreen', action: 'deleteExpenseItem' }) },
                        );
                        setUndoState({ visible: true, expenseId: expense.id, itemId: expenseItemId });
                      }}
                      onEditItem={(item, itemIndex) => setQuickAdd({
                        visible: true,
                        editMode: {
                          type: 'expenseItem',
                          id: expense.id,
                          categoryId,
                          itemIndex,
                          initialValues: {
                            name: item.name,
                            amount: item.amount,
                            date: item.date,
                            isDeductible: item.isDeductible,
                          },
                        },
                      })}
                    />
                  )}
                </GlassCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      <UndoToast
        visible={undoState.visible}
        message={t('LabelUndoDelete')}
        onUndo={() => {
          if (undoState.itemId && undoState.expenseId) {
            restoreExpenseItem.mutate(
              { expenseId: undoState.expenseId, expenseItemId: undoState.itemId },
              { onError: (err) => captureError(err, { screen: 'ExpenseListScreen', action: 'restoreExpenseItem' }) },
            );
          } else if (undoState.expenseId) {
            restoreExpense.mutate(undoState.expenseId, {
              onError: (err) => captureError(err, { screen: 'ExpenseListScreen', action: 'restoreExpense' }),
            });
          }
        }}
        onDismiss={() => setUndoState({ visible: false, expenseId: null, itemId: null })}
      />

      {/* ── Local QuickAddModal — category pre-selected ─────────────── */}
      <QuickAddModal
        visible={quickAdd.visible}
        onClose={() => setQuickAdd({ visible: false })}
        month={month}
        defaultCategoryId={quickAdd.defaultExpenseId ? categoryId : (!quickAdd.editMode ? categoryId : undefined)}
        defaultExpenseId={quickAdd.defaultExpenseId}
        editMode={quickAdd.editMode}
      />
    </GlassScreen>
  );
};

// ── Expanded items section ──────────────────────────────────────────────────
interface ItemsSectionProps {
  expense: Expense;
  currency: string;
  color: string;
  dark: boolean;
  ink: string; ink2: string; hair: string;
  canEdit: boolean;
  t: TFunction;
  onAddItemPressed: () => void;
  onDeleteItem: (id: string) => void;
  onEditItem: (item: ExpenseItem, itemIndex: number) => void;
}

const ExpenseItemsSection: React.FC<ItemsSectionProps> = ({
  expense, currency, color, dark, ink, ink2, hair, canEdit, t, onAddItemPressed, onDeleteItem, onEditItem,
}) => {
  const tintBg = dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.3)';
  const itemCount = expense.items?.length ?? 0;

  return (
    <View style={[styles.itemsSection, { borderTopColor: hair, backgroundColor: tintBg }]}>
      {expense.items?.map((item, i) => (
        <ExpenseItemRow
          key={item.id}
          item={item}
          currency={currency}
          color={color}
          ink={ink}
          ink2={ink2}
          hair={hair}
          isFirst={i === 0}
          isLast={i === itemCount - 1}
          showBottomBorder={!(i === itemCount - 1 && !canEdit)}
          canEdit={canEdit}
          onDelete={() => onDeleteItem(item.id)}
          onEdit={() => onEditItem(item, i)}
        />
      ))}

      {canEdit && (
        <TouchableOpacity
          onPress={onAddItemPressed}
          style={styles.addItemBtn}
          hitSlop={6}
        >
          <MaterialCommunityIcons name="plus-circle-outline" size={15} color={color} />
          <Text style={[styles.addItemLabel, { color }]}>
            {t('ButtonAddItem') ?? 'Add item'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// ── Single item row ─────────────────────────────────────────────────────────
interface ItemRowProps {
  item: ExpenseItem;
  currency: string;
  color: string;
  ink: string; ink2: string; hair: string;
  isFirst: boolean;
  isLast: boolean;
  showBottomBorder: boolean;
  canEdit: boolean;
  onDelete: () => void;
  onEdit: () => void;
}

const ExpenseItemRow: React.FC<ItemRowProps> = ({
  item, currency, color, ink, ink2, hair, isFirst, isLast, showBottomBorder, canEdit, onDelete, onEdit,
}) => {
  const { customColors, colors } = useAppTheme();
  const { t } = useTranslation();
  const date = fromDateOnly(item.date);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const fmt = (n: number) => formatAmount(n, i18n.language);
  const hasProof = item.attachments.length > 0;

  return (
    <SwipeableRow
      disabled={!canEdit}
      actionIcon="trash-can-outline"
      actionColor={customColors.expense}
      onAction={onDelete}
    >
      <TouchableOpacity
        onPress={onEdit}
        activeOpacity={0.72}
        style={[styles.itemRow, { borderBottomColor: showBottomBorder ? hair : 'transparent' }]}
      >
        {/* Timeline column */}
        <View style={styles.timelineCol}>
          <View style={[styles.timelineLineTop, { backgroundColor: isFirst ? 'transparent' : color + '55' }]} />
          <View style={[styles.timelineDot, { backgroundColor: color }]} />
          <View style={[styles.timelineLineBottom, { backgroundColor: isLast ? 'transparent' : color + '55' }]} />
        </View>

        {/* Body */}
        <View style={styles.itemBody}>
          <View style={styles.itemLeft}>
            <Text style={[styles.itemName, { color: ink }]} numberOfLines={1}>
              {item.name?.trim() || '—'}
            </Text>
            <View style={styles.itemSubRow}>
              <Text style={[styles.itemDate, { color: ink2 }]}>{dateStr}</Text>
              {item.isDeductible && (
                <View style={[styles.deductBadge, { backgroundColor: colors.primary + '26' }]}>
                  <Text style={[styles.deductBadgeText, { color: colors.primary }]}>
                    {t('LabelDeductible')}
                  </Text>
                </View>
              )}
              {hasProof && (
                <View style={[styles.proofBadge, { backgroundColor: ink2 + '22' }]}>
                  <MaterialCommunityIcons name="paperclip" size={9} color={ink2} />
                  <Text style={[styles.proofBadgeText, { color: ink2 }]}>
                    {t('LabelProofAttached')}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Text style={[styles.itemAmt, { color: customColors.expense }]}>
            −{currency} {fmt(item.amount)}
          </Text>
        </View>
      </TouchableOpacity>
    </SwipeableRow>
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
  summaryMeta:       { flex: 1 },
  summaryMonthLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  summaryAmt:        { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  summaryBudget:     { fontSize: 12, marginTop: 2 },
  summaryBar:        { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  summaryBarFill:    { height: 4, borderRadius: 2 },

  sectionHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  sectionCount: { fontSize: 12.5, fontWeight: '600' },

  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, opacity: 0.6 },

  groupList: { paddingHorizontal: 18, gap: 10 },
  groupCard: {},
  overspendAccent: {
    position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
    borderTopLeftRadius: 18, borderBottomLeftRadius: 18,
  },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13,
  },
  groupIcon: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  groupInfo:    { flex: 1, gap: 2, minWidth: 0 },
  groupName:    { fontSize: 14, fontWeight: '700' },
  groupSubRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  groupSub:     { fontSize: 11.5 },
  groupAmtCol:  { alignItems: 'flex-end', flexShrink: 0 },
  groupAmt:     { fontSize: 13.5, fontWeight: '800' },
  groupBudget:  { fontSize: 10, fontWeight: '500', marginTop: 1 },
  groupAction:  { padding: 4 },

  deductBadge: {
    borderRadius: 999,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  deductBadgeText: { fontSize: 10, fontWeight: '700' },
  proofBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1,
  },
  proofBadgeText: { fontSize: 10, fontWeight: '600' },

  itemsSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  // paddingVertical intentionally removed — lives in itemBody so timelineCol fills full row height
  itemRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timelineCol:        { width: 16, alignItems: 'center', alignSelf: 'stretch', flexShrink: 0 },
  timelineLineTop:    { flex: 1, width: 2 },
  timelineDot:        { width: 8, height: 8, borderRadius: 4 },
  timelineLineBottom: { flex: 1, width: 2 },
  itemBody:    { flex: 1, flexDirection: 'row', alignItems: 'center', paddingVertical: 9, paddingLeft: 10, paddingRight: 10, gap: 10 },
  itemLeft:    { flex: 1, gap: 2 },
  itemSubRow:  { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  itemName:   { fontSize: 13.5, fontWeight: '600' },
  itemDate:   { fontSize: 11 },
  itemAmt:    { fontSize: 13.5, fontWeight: '700' },
  itemDelete: { padding: 3 },

  addItemBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingLeft: 4 },
  addItemLabel: { fontSize: 13, fontWeight: '700' },
});
