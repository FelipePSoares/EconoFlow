import React, { useState } from 'react';
import {
  StyleSheet, TouchableOpacity, View,
  ScrollView, RefreshControl, TextInput,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import {
  useExpensesForMonth, useDeleteExpense,
  useAddExpenseItem, useDeleteExpenseItem,
} from '../../hooks/useExpenses';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { fromDateOnly, toDateOnly, formatMonthLabel } from '../../utils/date';
import { toggleSetItem } from '../../utils/budget';
import { getCategoryColor } from '../../utils/categoryTheme';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import type { TFunction } from 'i18next';
import type { CreateExpenseItemRequest, Expense, ExpenseItem } from '../../api/types';

type Props = NativeStackScreenProps<OverviewStackParamList, 'ExpenseList'>;

function fmt(n: number): string {
  return Math.round(Math.abs(n)).toLocaleString('pt-BR');
}

export const ExpenseListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2, hair } = useAuroraSkin();
  const insets = useSafeAreaInsets();

  const { categoryId, categoryName, month, categoryIndex = 0 } = route.params;
  const color = getCategoryColor(categoryIndex);

  const { selectedProject, currency } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';
  const canEdit = selectedProject?.role !== 'Viewer';

  const { data: expenses, isLoading, refetch } =
    useExpensesForMonth(projectId, categoryId, month);
  const deleteExpense    = useDeleteExpense(projectId, categoryId, month);
  const addExpenseItem   = useAddExpenseItem(projectId, categoryId, month);
  const deleteExpenseItem = useDeleteExpenseItem(projectId, categoryId, month);

  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <LoadingIndicator />;

  const list = expenses ?? [];
  const totalSpent  = list.reduce((s, e) => s + e.amount, 0);
  const totalBudget = list.reduce((s, e) => s + e.budget, 0);
  const pct = totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0;

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

        {canEdit && (
          <TouchableOpacity
            onPress={() => navigation.navigate('ExpenseForm', { categoryId, month })}
            style={[styles.headerBtn, { borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)', backgroundColor: color }]}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView
        style={styles.fill}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink2} />
        }
      >
        {/* ── Summary card ─────────────────────────────────────────────── */}
        <GlassCard dark={dark} radius={26} style={styles.summaryCard}>
          <View style={styles.summaryInner}>
            {/* Ring indicator */}
            <View style={styles.ringWrap}>
              <View style={[styles.ringOuter, { borderColor: color + '44' }]}>
                <View style={[
                  styles.ringProgress,
                  {
                    borderTopColor: color,
                    borderLeftColor: color,
                    borderRightColor: 'transparent',
                    borderBottomColor: pct > 50 ? color : 'transparent',
                    transform: [{ rotate: '-45deg' }],
                  },
                ]} />
                <View style={styles.ringCenter}>
                  <MaterialCommunityIcons name="shape-outline" size={24} color={color} />
                </View>
              </View>
            </View>

            {/* Text info */}
            <View style={styles.summaryMeta}>
              <Text style={[styles.summaryMonthLabel, { color: ink2 }]}>
                {t('LabelExpenses') ?? 'Expenses'} · {formatMonthLabel(month)}
              </Text>
              <Text style={[styles.summaryAmt, { color: ink }]}>
                {currency} {fmt(totalSpent)}
              </Text>
              {totalBudget > 0 && (
                <Text style={[styles.summaryBudget, { color: ink2 }]}>
                  {t('Budget') ?? 'of'} {currency} {fmt(totalBudget)} · {pct}%
                </Text>
              )}
              {/* Progress bar */}
              <View style={[styles.summaryBar, { backgroundColor: color + '22' }]}>
                <View style={[
                  styles.summaryBarFill,
                  { width: `${pct}%` as `${number}%`, backgroundColor: color },
                ]} />
              </View>
            </View>
          </View>
        </GlassCard>

        {/* ── Section header ────────────────────────────────────────────── */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: ink }]}>
            {t('ListExpenses') ?? 'Expense groups'}
          </Text>
          <Text style={[styles.sectionCount, { color: ink2 }]}>
            {list.length} {t('LabelExpenseItems') ?? 'items'}
          </Text>
        </View>

        {/* ── Expense group accordion ───────────────────────────────────── */}
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
              const isOpen = expandedIds.has(expense.id);
              return (
                <GlassCard key={expense.id} dark={dark} radius={18} style={styles.groupCard}>
                  {/* ── Group header ──────────────────────────────────── */}
                  <TouchableOpacity
                    onPress={() => setExpandedIds(prev => toggleSetItem(prev, expense.id))}
                    activeOpacity={0.75}
                    style={styles.groupHeader}
                  >
                    <View style={[styles.groupIcon, { backgroundColor: color + (dark ? '33' : '22') }]}>
                      <MaterialCommunityIcons name="wallet-outline" size={20} color={color} />
                    </View>

                    <View style={styles.groupInfo}>
                      <Text style={[styles.groupName, { color: ink }]}>{expense.name}</Text>
                      <Text style={[styles.groupSub, { color: ink2 }]}>
                        {expense.items?.length > 0
                          ? `${expense.items.length} ${t('LabelExpenseItems') ?? 'items'}`
                          : fromDateOnly(expense.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </Text>
                    </View>

                    <Text style={[styles.groupAmt, { color: '#e74c3c' }]}>
                      −{currency} {fmt(expense.amount)}
                    </Text>

                    {canEdit && (
                      <>
                        <TouchableOpacity
                          onPress={() => navigation.navigate('ExpenseForm', {
                            categoryId, month, expenseId: expense.id,
                            initialValues: {
                              name: expense.name, amount: expense.amount,
                              budget: expense.budget, date: expense.date,
                              isDeductible: expense.isDeductible,
                            },
                          })}
                          hitSlop={6}
                          style={styles.groupAction}
                        >
                          <MaterialCommunityIcons name="pencil-outline" size={16} color={ink2} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => setPendingDeleteId(expense.id)}
                          hitSlop={6}
                          style={styles.groupAction}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={16} color="#e74c3c" />
                        </TouchableOpacity>
                      </>
                    )}

                    <MaterialCommunityIcons
                      name="chevron-down"
                      size={20}
                      color={ink2}
                      style={{ transform: [{ rotate: isOpen ? '180deg' : '0deg' }] }}
                    />
                  </TouchableOpacity>

                  {/* ── Expanded items ────────────────────────────────── */}
                  {isOpen && (
                    <ExpenseItemsSection
                      expense={expense}
                      currency={currency}
                      color={color}
                      dark={dark}
                      ink={ink}
                      ink2={ink2}
                      hair={hair}
                      canEdit={canEdit}
                      t={t}
                      onAddItem={(item) =>
                        addExpenseItem.mutate({ expenseId: expense.id, item })
                      }
                      onDeleteItem={(expenseItemId) =>
                        deleteExpenseItem.mutate({ expenseId: expense.id, expenseItemId })
                      }
                    />
                  )}
                </GlassCard>
              );
            })}
          </View>
        )}
      </ScrollView>

      <ConfirmDialog
        visible={!!pendingDeleteId}
        title={t('LabelDeleteExpense') ?? 'Delete expense'}
        message={t('LabelConfirmDeleteExpense') ?? 'Are you sure?'}
        onConfirm={() => {
          if (!pendingDeleteId) return;
          deleteExpense.mutate(pendingDeleteId, {
            onSuccess: () => setPendingDeleteId(null),
          });
        }}
        onCancel={() => setPendingDeleteId(null)}
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
  onAddItem: (item: CreateExpenseItemRequest) => void;
  onDeleteItem: (id: string) => void;
}

const ExpenseItemsSection: React.FC<ItemsSectionProps> = ({
  expense, currency, color, dark, ink, ink2, hair, canEdit, t, onAddItem, onDeleteItem,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');

  const save = () => {
    onAddItem({ name: newName.trim(), date: toDateOnly(new Date()), amount: parseFloat(newAmount) || 0 });
    setIsAdding(false); setNewName(''); setNewAmount('');
  };

  const tintBg     = dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.3)';
  const inputBg    = dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.6)';
  const inputBorderColor = dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.7)';

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
          isLast={i === (expense.items?.length ?? 0) - 1 && !canEdit}
          canEdit={canEdit}
          onDelete={() => onDeleteItem(item.id)}
        />
      ))}

      {canEdit && !isAdding && (
        <TouchableOpacity
          onPress={() => setIsAdding(true)}
          style={styles.addItemBtn}
          hitSlop={6}
        >
          <MaterialCommunityIcons name="plus-circle-outline" size={15} color={color} />
          <Text style={[styles.addItemLabel, { color }]}>
            {t('ButtonAddItem') ?? 'Add item'}
          </Text>
        </TouchableOpacity>
      )}

      {isAdding && (
        <View style={styles.addItemForm}>
          <TextInput
            placeholder={t('FieldExpenseName') ?? 'Name (optional)'}
            value={newName}
            onChangeText={setNewName}
            placeholderTextColor={ink2}
            style={[styles.addItemInput, { color: ink, backgroundColor: inputBg, borderColor: inputBorderColor }]}
          />
          <TextInput
            placeholder={t('FieldAmount') ?? 'Amount'}
            value={newAmount}
            onChangeText={setNewAmount}
            keyboardType="decimal-pad"
            placeholderTextColor={ink2}
            style={[styles.addItemInput, { color: ink, backgroundColor: inputBg, borderColor: inputBorderColor }]}
          />
          <View style={styles.addItemActions}>
            <TouchableOpacity onPress={() => { setIsAdding(false); setNewName(''); setNewAmount(''); }} hitSlop={8}>
              <Text style={[styles.addItemAction, { color: ink2 }]}>{t('ButtonCancel') ?? 'Cancel'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={save} hitSlop={8}>
              <Text style={[styles.addItemAction, { color }]}>{t('ButtonSave') ?? 'Save'}</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  isLast: boolean;
  canEdit: boolean;
  onDelete: () => void;
}

const ExpenseItemRow: React.FC<ItemRowProps> = ({
  item, currency, color, ink, ink2, hair, isLast, canEdit, onDelete,
}) => {
  const date = fromDateOnly(item.date);
  const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <View style={[styles.itemRow, { borderBottomColor: isLast ? 'transparent' : hair }]}>
      {/* Colored bullet */}
      <View style={[styles.itemBullet, { backgroundColor: color }]} />

      <View style={styles.itemLeft}>
        <Text style={[styles.itemName, { color: ink }]} numberOfLines={1}>
          {item.name?.trim() || '—'}
        </Text>
        <Text style={[styles.itemDate, { color: ink2 }]}>{dateStr}</Text>
      </View>

      <Text style={[styles.itemAmt, { color: ink }]}>
        {currency} {fmt(item.amount)}
      </Text>

      {canEdit && (
        <TouchableOpacity onPress={onDelete} hitSlop={8} style={styles.itemDelete}>
          <MaterialCommunityIcons name="trash-can-outline" size={15} color="#e74c3c" />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { flex: 1 },

  // Custom header
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
  },
  headerTitle: { flex: 1, alignItems: 'center' },
  headerName:  { fontSize: 16, fontWeight: '800' },
  headerMonth: { fontSize: 11.5, fontWeight: '600' },

  // Summary card
  summaryCard:  { marginHorizontal: 18, marginBottom: 16 },
  summaryInner: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18 },
  ringWrap:     { flexShrink: 0 },
  ringOuter: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 8,
    alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  ringProgress: {
    position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 8,
  },
  ringCenter: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  summaryMeta:       { flex: 1 },
  summaryMonthLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  summaryAmt:        { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  summaryBudget:     { fontSize: 12, marginTop: 2 },
  summaryBar:        { height: 4, borderRadius: 2, marginTop: 8, overflow: 'hidden' },
  summaryBarFill:    { height: 4, borderRadius: 2 },

  // Section header
  sectionHead:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingHorizontal: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800' },
  sectionCount: { fontSize: 12.5, fontWeight: '600' },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 12 },
  emptyText: { fontSize: 14, opacity: 0.6 },

  // Group list
  groupList: { paddingHorizontal: 18, gap: 10 },
  groupCard: {},
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13,
  },
  groupIcon: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  groupInfo:   { flex: 1, gap: 2 },
  groupName:   { fontSize: 14, fontWeight: '700' },
  groupSub:    { fontSize: 11.5 },
  groupAmt:    { fontSize: 13.5, fontWeight: '800' },
  groupAction: { padding: 4 },

  // Expanded items section
  itemsSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemBullet: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  itemLeft:   { flex: 1, gap: 2 },
  itemName:   { fontSize: 13.5, fontWeight: '600' },
  itemDate:   { fontSize: 11 },
  itemAmt:    { fontSize: 13.5, fontWeight: '700' },
  itemDelete: { padding: 3 },

  // Add item
  addItemBtn:     { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingLeft: 4 },
  addItemLabel:   { fontSize: 13, fontWeight: '700' },
  addItemForm:    { paddingVertical: 8, gap: 8 },
  addItemInput: {
    borderWidth: 1, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 13.5,
  },
  addItemActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 18 },
  addItemAction:  { fontSize: 13.5, fontWeight: '700' },
});
