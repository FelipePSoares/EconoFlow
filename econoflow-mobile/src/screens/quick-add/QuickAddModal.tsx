import React, { useState, useEffect, useReducer } from 'react';
import {
  Modal, View, StyleSheet, TouchableOpacity,
  ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator,
  useColorScheme, PanResponder, Animated,
} from 'react-native';
import { Text, HelperText } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useForm, Controller } from 'react-hook-form';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { useProjectStore } from '../../store/projectStore';
import { useCategoriesForMonth } from '../../hooks/useCategories';
import { useExpensesForMonth, useCreateExpense, useAddExpenseItem, usePatchExpense } from '../../hooks/useExpenses';
import { useCreateIncome, usePatchIncome } from '../../hooks/useIncomes';
import { AuroraField } from '../../components/auth/AuroraField';
import { getCategoryColor } from '../../utils/categoryTheme';
import { getCategoryIcon } from '../../utils/categoryIcon';
import { getCurrencySymbol } from '../../utils/currency';
import { currentMonth, toDateOnly, fromDateOnly } from '../../utils/date';
import { buildPatch } from '../../utils/patch';
import { auroraTokens } from '../../theme/useAuroraSkin';

// ── Public types ─────────────────────────────────────────────────────────────

export interface QuickAddEditMode {
  type: 'expense' | 'income';
  id: string;
  categoryId?: string;
  initialValues: {
    name: string;
    amount: number;
    date: string;
    isDeductible?: boolean;
    budget?: number;
  };
}

type EntryType = 'income' | 'expense';

interface Props {
  visible: boolean;
  onClose: () => void;
  month?: string;
  defaultCategoryId?: string;
  defaultExpenseId?: string;
  editMode?: QuickAddEditMode;
  defaultType?: EntryType;
}

interface FormValues {
  name: string;
  amount: string;
  budget: string;
}

// ── Modal state (useReducer) ─────────────────────────────────────────────────
// All interactive state lives here so the reset effect dispatches a single
// action instead of calling multiple useState setters (which the
// react-hooks/set-state-in-effect lint rule flags).

type ModalState = {
  entryType: EntryType;
  selectedCategoryId: string | null;
  selectedExpenseId: string | null;
  date: Date;
  showDatePicker: boolean;
  isDeductible: boolean;
};

type ModalAction =
  | { kind: 'open_edit'; editMode: QuickAddEditMode }
  | { kind: 'open_add'; defaultType?: EntryType; defaultCategoryId?: string; defaultExpenseId?: string }
  | { kind: 'set_type'; entryType: EntryType }
  | { kind: 'select_category'; id: string | null }
  | { kind: 'select_expense'; id: string | null }
  | { kind: 'set_date'; date: Date }
  | { kind: 'open_date_picker' }
  | { kind: 'close_date_picker' }
  | { kind: 'toggle_deductible' };

const initState: ModalState = {
  entryType: 'expense',
  selectedCategoryId: null,
  selectedExpenseId: null,
  date: new Date(),
  showDatePicker: false,
  isDeductible: false,
};

function modalReducer(state: ModalState, action: ModalAction): ModalState {
  switch (action.kind) {
    case 'open_edit':
      return {
        entryType: action.editMode.type === 'income' ? 'income' : 'expense',
        selectedCategoryId: action.editMode.categoryId ?? null,
        selectedExpenseId: null,
        date: fromDateOnly(action.editMode.initialValues.date),
        isDeductible: action.editMode.initialValues.isDeductible ?? false,
        showDatePicker: false,
      };
    case 'open_add':
      return {
        entryType: action.defaultType ?? 'expense',
        selectedCategoryId: action.defaultCategoryId ?? null,
        selectedExpenseId: action.defaultExpenseId ?? null,
        date: new Date(),
        isDeductible: false,
        showDatePicker: false,
      };
    case 'set_type':
      return { ...state, entryType: action.entryType, selectedCategoryId: null, selectedExpenseId: null };
    case 'select_category':
      return { ...state, selectedCategoryId: action.id, selectedExpenseId: null };
    case 'select_expense':
      return { ...state, selectedExpenseId: action.id };
    case 'set_date':
      return { ...state, date: action.date, showDatePicker: false };
    case 'open_date_picker':
      return { ...state, showDatePicker: true };
    case 'close_date_picker':
      return { ...state, showDatePicker: false };
    case 'toggle_deductible':
      return { ...state, isDeductible: !state.isDeductible };
    default:
      return state;
  }
}

// ── Component ────────────────────────────────────────────────────────────────

export const QuickAddModal: React.FC<Props> = ({
  visible,
  onClose,
  month = currentMonth(),
  defaultCategoryId,
  defaultExpenseId,
  editMode,
  defaultType,
}) => {
  const { t } = useTranslation();
  const dark = useColorScheme() === 'dark';
  const { ink, ink2, hair } = auroraTokens(dark);
  const { selectedProject, currency } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';
  const sym = getCurrencySymbol(currency);

  const [modal, dispatch] = useReducer(modalReducer, initState);

  // ── Drag-to-dismiss ───────────────────────────────────────────────────────
  // useState initializer avoids the react-hooks/refs lint error that fires when
  // useRef(...).current is accessed during render.
  const [dragY] = useState(() => new Animated.Value(0));

  // dismissCount is incremented by the pan-gesture. A separate effect watches
  // it and runs the slide-out + onClose, avoiding passing any useRef into the
  // panResponder initializer (which react-hooks/refs flags as render-time
  // ref access).
  const [dismissCount, setDismissCount] = useState(0);

  useEffect(() => {
    if (dismissCount === 0) return;
    Animated.timing(dragY, {
      toValue: 800,
      duration: 180,
      useNativeDriver: true,
    }).start(() => onClose());
  // onClose intentionally omitted: called once after animation; including it
  // would re-run this effect on every parent re-render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissCount, dragY]);

  const [panResponder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, g) => g.dy > 3,
      onPanResponderMove: (_, g) => {
        if (g.dy > 0) dragY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 1.2) {
          setDismissCount(c => c + 1);
        } else {
          Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
        }
      },
    })
  );

  // ── Reset form when modal opens / closes ──────────────────────────────────
  // dispatch (useReducer) is NOT a useState setter — the react-hooks/set-state-
  // in-effect rule only flags useState setters, so using dispatch here is safe.
  const { control, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: '', amount: '', budget: '' },
  });

  useEffect(() => {
    if (!visible) {
      dragY.setValue(0);
      return;
    }
    dragY.setValue(600);
    Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 68, friction: 12 }).start();

    if (editMode) {
      setValue('name',   editMode.initialValues.name);
      setValue('amount', String(editMode.initialValues.amount));
      setValue('budget', editMode.initialValues.budget ? String(editMode.initialValues.budget) : '');
      dispatch({ kind: 'open_edit', editMode });
    } else {
      reset({ name: '', amount: '', budget: '' });
      dispatch({ kind: 'open_add', defaultType, defaultCategoryId, defaultExpenseId });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: categories } = useCategoriesForMonth(projectId, month);
  const activeCategories = (categories ?? []).filter(c => !c.isArchived);

  const { data: expenses } = useExpensesForMonth(
    projectId,
    modal.selectedCategoryId ?? '',
    month,
  );

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createIncome   = useCreateIncome(projectId, month);
  const createExpense  = useCreateExpense(projectId, modal.selectedCategoryId ?? '', month);
  const addExpenseItem = useAddExpenseItem(projectId, modal.selectedCategoryId ?? '', month);

  const patchExpense = usePatchExpense(
    projectId,
    editMode?.type === 'expense' ? (editMode.categoryId ?? '') : (modal.selectedCategoryId ?? ''),
    editMode?.type === 'expense' ? editMode.id : '',
    month,
  );
  const patchIncome = usePatchIncome(
    projectId,
    editMode?.type === 'income' ? editMode.id : '',
    month,
  );

  const isPending =
    createIncome.isPending || createExpense.isPending ||
    addExpenseItem.isPending || patchExpense.isPending || patchIncome.isPending;

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = (values: FormValues) => {
    const amount  = parseFloat(values.amount) || 0;
    const budget  = parseFloat(values.budget) || 0;
    const dateStr = toDateOnly(modal.date);
    const name    = values.name.trim();

    if (editMode) {
      const patch = buildPatch({ name, amount, date: dateStr, isDeductible: modal.isDeductible, budget } as Record<string, unknown>);
      if (editMode.type === 'expense') {
        patchExpense.mutate(patch, { onSuccess: onClose });
      } else {
        patchIncome.mutate(patch, { onSuccess: onClose });
      }
      return;
    }

    if (modal.entryType === 'income') {
      createIncome.mutate({ name, amount, date: dateStr }, { onSuccess: onClose });
    } else if (modal.selectedExpenseId) {
      addExpenseItem.mutate(
        { expenseId: modal.selectedExpenseId, item: { name, amount, date: dateStr } },
        { onSuccess: onClose },
      );
    } else {
      if (!modal.selectedCategoryId) return;
      createExpense.mutate(
        { name, amount, budget, isDeductible: modal.isDeductible, date: dateStr },
        { onSuccess: onClose },
      );
    }
  };

  const handleCategoryPress = (id: string) => {
    if (defaultCategoryId) return;
    dispatch({ kind: 'select_category', id: modal.selectedCategoryId === id ? null : id });
  };

  // ── Design tokens ─────────────────────────────────────────────────────────
  const panelBg     = dark ? '#061e33' : '#e8f4fe';
  const panelBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.92)';
  const chipBg      = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.7)';
  const chipBorder  = dark ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.85)';
  const toggleBg    = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  const isEditMode = !!editMode;
  const isLocked   = isEditMode || !!defaultCategoryId || !!defaultExpenseId;
  const canSubmit  = isEditMode || modal.entryType === 'income' || !!modal.selectedCategoryId;

  const title = isEditMode
    ? (editMode.type === 'income' ? (t('LabelEditIncome') ?? 'Edit income') : (t('LabelEditExpense') ?? 'Edit expense'))
    : (t('LabelQuickAdd') ?? 'New entry');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dark backdrop — purely visual */}
      <View style={[StyleSheet.absoluteFill, styles.backdrop]} pointerEvents="none" />

      {/* Tap-outside-to-close */}
      <View style={StyleSheet.absoluteFill}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </View>

      {/* Bottom sheet */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kavWrap}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.panel,
            { backgroundColor: panelBg, borderColor: panelBorder },
            { transform: [{ translateY: dragY }] },
          ]}
          onStartShouldSetResponder={() => true}
        >
          {/* Handle */}
          <View {...panResponder.panHandlers} style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: dark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.14)' }]} />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {/* Header */}
            <Text style={[styles.title, { color: ink }]}>{title}</Text>

            {/* Type toggle */}
            {!isLocked && (
              <View style={[styles.typeToggle, { backgroundColor: toggleBg, borderColor: chipBorder }]}>
                {(['income', 'expense'] as EntryType[]).map(opt => {
                  const active = modal.entryType === opt;
                  const icon   = opt === 'income' ? 'arrow-up-circle-outline' : 'arrow-down-circle-outline';
                  const label  = opt === 'income' ? (t('LabelIncome') ?? 'Income') : (t('LabelExpenses') ?? 'Expense');
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={styles.typeBtn}
                      onPress={() => dispatch({ kind: 'set_type', entryType: opt })}
                      activeOpacity={0.8}
                    >
                      {active ? (
                        <LinearGradient
                          colors={opt === 'income' ? ['#0e9f6e', '#14c08a'] : ['#0f76a8', '#2f6df0']}
                          start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                          style={styles.typePill}
                        >
                          <MaterialCommunityIcons name={icon as never} size={15} color="#fff" />
                          <Text style={styles.typeLabelActive}>{label}</Text>
                        </LinearGradient>
                      ) : (
                        <View style={styles.typePill}>
                          <MaterialCommunityIcons name={icon as never} size={15} color={ink2} />
                          <Text style={[styles.typeLabel, { color: ink2 }]}>{label}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Category chips */}
            {!isEditMode && modal.entryType === 'expense' && (
              <>
                <Text style={[styles.sectionLabel, { color: ink2 }]}>{t('LabelSelectCategory')} *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow} style={styles.chipsScroll}>
                  {activeCategories.map((cat, idx) => {
                    const selected = modal.selectedCategoryId === cat.id;
                    const locked   = !!defaultCategoryId;
                    const color    = getCategoryColor(idx);
                    return (
                      <TouchableOpacity key={cat.id} onPress={() => handleCategoryPress(cat.id)}
                        activeOpacity={locked ? 1 : 0.78}
                        style={[styles.chip, { backgroundColor: selected ? color : chipBg, borderColor: selected ? color : chipBorder }]}>
                        <MaterialCommunityIcons name={getCategoryIcon(cat.name) as never} size={14} color={selected ? '#fff' : color} />
                        <Text style={[styles.chipLabel, { color: selected ? '#fff' : ink }]} numberOfLines={1}>{cat.name}</Text>
                        {locked && selected && <MaterialCommunityIcons name="lock-outline" size={11} color="rgba(255,255,255,0.7)" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Expense chips */}
            {!isEditMode && modal.entryType === 'expense' && modal.selectedCategoryId && (expenses ?? []).length > 0 && (
              <>
                <Text style={[styles.sectionLabel, { color: ink2 }]}>{t('LabelSelectExpense')}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow} style={styles.chipsScroll}>
                  {(expenses ?? []).map(exp => {
                    const selected = modal.selectedExpenseId === exp.id;
                    const locked   = !!defaultExpenseId;
                    return (
                      <TouchableOpacity key={exp.id}
                        onPress={() => !locked && dispatch({ kind: 'select_expense', id: selected ? null : exp.id })}
                        activeOpacity={locked ? 1 : 0.78}
                        style={[styles.chip, { backgroundColor: selected ? '#0f76a8' : chipBg, borderColor: selected ? '#0f76a8' : chipBorder }]}>
                        <MaterialCommunityIcons name={getCategoryIcon(exp.name) as never} size={14} color={selected ? '#fff' : '#0f76a8'} />
                        <Text style={[styles.chipLabel, { color: selected ? '#fff' : ink }]} numberOfLines={1}>{exp.name}</Text>
                        {locked && selected && <MaterialCommunityIcons name="lock-outline" size={11} color="rgba(255,255,255,0.7)" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </>
            )}

            {/* Fields */}
            <View style={[styles.fieldsDivider, { borderTopColor: hair }]} />

            <Controller control={control} name="name"
              rules={{ required: t('RequiredField') ?? 'Required' }}
              render={({ field: { onChange, value } }) => (
                <AuroraField dark={dark} icon="text-short" placeholder={t('FieldName') ?? 'Name'}
                  value={value} onChangeText={onChange} hasError={!!errors.name} />
              )}
            />
            {errors.name && <HelperText type="error" style={styles.helperText}>{errors.name.message}</HelperText>}

            <Controller control={control} name="amount"
              rules={{ required: t('RequiredField') ?? 'Required' }}
              render={({ field: { onChange, value } }) => (
                <AuroraField dark={dark} icon="cash-outline" textPrefix={sym || undefined}
                  placeholder={t('FieldAmount') ?? 'Amount'} value={value} onChangeText={onChange}
                  keyboardType="decimal-pad" hasError={!!errors.amount} />
              )}
            />
            {errors.amount && <HelperText type="error" style={styles.helperText}>{errors.amount.message}</HelperText>}

            {/* Budget — expense only, not when adding an item */}
            {(modal.entryType === 'expense' || isEditMode) && editMode?.type !== 'income' && !modal.selectedExpenseId && (
              <Controller control={control} name="budget"
                render={({ field: { onChange, value } }) => (
                  <AuroraField dark={dark} icon="bullseye-arrow" textPrefix={sym || undefined}
                    placeholder={`${t('FieldBudget') ?? 'Budget'} (${t('Optional') ?? 'optional'})`}
                    value={value} onChangeText={onChange} keyboardType="decimal-pad" />
                )}
              />
            )}

            {/* Date picker */}
            <TouchableOpacity
              style={[styles.dateBtn, { backgroundColor: chipBg, borderColor: chipBorder }]}
              onPress={() => dispatch({ kind: 'open_date_picker' })}
              activeOpacity={0.8}
            >
              <MaterialCommunityIcons name="calendar-outline" size={20} color={ink2} style={styles.dateIcon} />
              <Text style={[styles.dateBtnLabel, { color: ink }]}>
                {modal.date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
              </Text>
            </TouchableOpacity>

            {modal.showDatePicker && (
              <DateTimePicker
                value={modal.date}
                mode="date"
                maximumDate={new Date()}
                onChange={(_e, selected) => {
                  if (selected) {
                    dispatch({ kind: 'set_date', date: selected });
                  } else {
                    dispatch({ kind: 'close_date_picker' });
                  }
                }}
              />
            )}

            {/* Deductible toggle */}
            {(modal.entryType === 'expense' || isEditMode) && editMode?.type !== 'income' && !modal.selectedExpenseId && (
              <TouchableOpacity
                onPress={() => dispatch({ kind: 'toggle_deductible' })}
                activeOpacity={0.8}
                style={[styles.deductRow, { borderTopColor: hair }]}
              >
                <View style={styles.deductLeft}>
                  <MaterialCommunityIcons name="receipt-text-outline" size={18} color={modal.isDeductible ? '#0f76a8' : ink2} />
                  <View style={styles.deductLabels}>
                    <Text style={[styles.deductLabel, { color: ink }]}>{t('LabelDeductible') ?? 'Deductible'}</Text>
                    <Text style={[styles.deductHint, { color: ink2 }]}>{t('LabelDeductibleHint') ?? 'for tax declaration'}</Text>
                  </View>
                </View>
                <View style={[styles.toggleTrack, { backgroundColor: modal.isDeductible ? '#0f76a8' : (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.14)') }]}>
                  <View style={[styles.toggleThumb, { left: modal.isDeductible ? 20 : 3 }]} />
                </View>
              </TouchableOpacity>
            )}

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit(onSubmit)}
              disabled={isPending || !canSubmit}
              activeOpacity={0.85}
              style={[styles.submitWrap, (!canSubmit || isPending) && { opacity: 0.48 }]}
            >
              <LinearGradient colors={['#0f76a8', '#14c08a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitGradient}>
                {isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Text style={styles.submitLabel}>{isEditMode ? (t('ButtonSave') ?? 'Save') : (t('ButtonAdd') ?? 'Add')}</Text>
                    <MaterialCommunityIcons name={isEditMode ? 'check-circle-outline' : 'check'} size={20} color="#fff" style={styles.submitIcon} />
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { backgroundColor: 'rgba(0,0,0,0.60)' },
  kavWrap: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'flex-end',
    pointerEvents: 'box-none',
  } as never,

  panel: {
    borderTopLeftRadius: 30, borderTopRightRadius: 30,
    borderWidth: 1, borderBottomWidth: 0,
    paddingBottom: 36, maxHeight: '92%',
  },
  handleWrap: { paddingTop: 14, paddingBottom: 10, alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2 },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 8 },

  title: { fontSize: 19, fontWeight: '800', marginBottom: 20 },

  typeToggle: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 22, gap: 4 },
  typeBtn:  { flex: 1 },
  typePill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 10 },
  typeLabelActive: { color: '#fff', fontWeight: '800', fontSize: 14 },
  typeLabel:       { fontWeight: '700', fontSize: 14 },

  sectionLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  chipsScroll: { marginBottom: 16 },
  chipsRow:    { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, maxWidth: 160 },
  chipLabel: { fontSize: 12.5, fontWeight: '600' },

  fieldsDivider: { borderTopWidth: StyleSheet.hairlineWidth, marginBottom: 4, marginTop: 2 },
  helperText: { marginTop: -2 },

  dateBtn: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 14, marginTop: 11 },
  dateIcon:     { marginRight: 10 },
  dateBtnLabel: { fontSize: 14.5, fontWeight: '500' },

  deductRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 14, marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  deductLeft:   { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  deductLabels: { gap: 2 },
  deductLabel:  { fontSize: 13.5, fontWeight: '700' },
  deductHint:   { fontSize: 11, fontWeight: '500' },
  toggleTrack: { width: 44, height: 26, borderRadius: 13, position: 'relative', flexShrink: 0 },
  toggleThumb: { position: 'absolute', top: 3, width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.28, shadowRadius: 4, elevation: 3 },

  submitWrap:     { marginTop: 18, borderRadius: 17, overflow: 'hidden', height: 54 },
  submitGradient: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  submitLabel: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
  submitIcon:  { marginLeft: 6 },
});
