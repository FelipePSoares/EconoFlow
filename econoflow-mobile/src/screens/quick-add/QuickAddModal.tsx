import React, { useState, useEffect, useReducer, useRef } from 'react';
import {
  Modal, View, StyleSheet, TouchableOpacity, TextInput, Pressable,
  ScrollView, KeyboardAvoidingView, ActivityIndicator,
  useColorScheme, useWindowDimensions, PanResponder, Animated,
} from 'react-native';
import { Text, HelperText } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useForm, Controller } from 'react-hook-form';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTranslation } from 'react-i18next';
import { captureError } from '../../monitoring/sentry';
import { useProjectStore } from '../../store/projectStore';
import { useCategoriesForMonth } from '../../hooks/useCategories';
import { useExpensesForMonth, useCreateExpense, useAddExpenseItem, usePatchExpense } from '../../hooks/useExpenses';
import { useCreateIncome, usePatchIncome } from '../../hooks/useIncomes';
import { AuroraField } from '../../components/auth/AuroraField';
import { getCategoryColor } from '../../utils/categoryTheme';
import { getCategoryIcon } from '../../utils/categoryIcon';
import { getCurrencySymbol } from '../../utils/currency';
import { currentMonth, toDateOnly, fromDateOnly, dateToMonth, defaultDateForMonth } from '../../utils/date';
import { buildPatch, buildExpenseItemPatch } from '../../utils/patch';
import { shouldShowAmountError } from '../../utils/amountValidation';
import { isNameRequired } from '../../utils/nameValidation';
import { extractApiErrors } from '../../utils/apiErrors';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { auroraTokens } from '../../theme/useAuroraSkin';

// ── Public types ─────────────────────────────────────────────────────────────

export interface QuickAddEditMode {
  type: 'expense' | 'income' | 'expenseItem';
  id: string;
  /** For expenseItem: 0-based index of the item in the parent expense's items array */
  itemIndex?: number;
  categoryId?: string;
  /** True when the expense has child items — amount is derived and read-only */
  hasItems?: boolean;
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
  amountText: string;
  amountError: boolean;
  dateApiError: string | undefined;
  amountApiError: string | undefined;
  apiError: string | undefined;
};

type ModalAction =
  | { kind: 'open_edit'; editMode: QuickAddEditMode }
  | { kind: 'open_add'; defaultType?: EntryType; defaultCategoryId?: string; defaultExpenseId?: string; initialDate?: Date }
  | { kind: 'set_type'; entryType: EntryType }
  | { kind: 'select_category'; id: string | null }
  | { kind: 'select_expense'; id: string | null }
  | { kind: 'set_date'; date: Date }
  | { kind: 'open_date_picker' }
  | { kind: 'close_date_picker' }
  | { kind: 'toggle_deductible' }
  | { kind: 'set_amount_text'; text: string }
  | { kind: 'set_amount_error'; error: boolean }
  | { kind: 'set_api_errors'; dateApiError: string | undefined; amountApiError: string | undefined; apiError: string | undefined };

const initState: ModalState = {
  entryType: 'expense',
  selectedCategoryId: null,
  selectedExpenseId: null,
  date: new Date(),
  showDatePicker: false,
  isDeductible: false,
  amountText: '',
  amountError: false,
  dateApiError: undefined,
  amountApiError: undefined,
  apiError: undefined,
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
        amountText: action.editMode.initialValues.amount > 0 ? String(Math.round(action.editMode.initialValues.amount * 100)) : '',
        amountError: false,
        dateApiError: undefined,
        amountApiError: undefined,
        apiError: undefined,
      };
    case 'open_add':
      return {
        entryType: action.defaultType ?? 'expense',
        selectedCategoryId: action.defaultCategoryId ?? null,
        selectedExpenseId: action.defaultExpenseId ?? null,
        date: action.initialDate ?? new Date(),
        isDeductible: false,
        showDatePicker: false,
        amountText: '',
        amountError: false,
        dateApiError: undefined,
        amountApiError: undefined,
        apiError: undefined,
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
    case 'set_amount_text':
      return { ...state, amountText: action.text };
    case 'set_amount_error':
      return { ...state, amountError: action.error };
    case 'set_api_errors':
      return { ...state, dateApiError: action.dateApiError, amountApiError: action.amountApiError, apiError: action.apiError };
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
  const { height: screenH } = useWindowDimensions();
  const panelH = Math.round(screenH * 0.88);
  const { ink, ink2, hair } = auroraTokens(dark);
  const { selectedProject, currency } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';
  const sym = getCurrencySymbol(currency);

  const [modal, dispatch] = useReducer(modalReducer, initState);
  const selectedMonth = dateToMonth(modal.date);

  // ── Drag-to-dismiss ───────────────────────────────────────────────────────
  // useState initializer avoids the react-hooks/refs lint error that fires when
  // useRef(...).current is accessed during render.
  const [dragY] = useState(() => new Animated.Value(0));

  // dismissCount is incremented by the pan-gesture. A separate effect watches
  // it and runs the slide-out + onClose, avoiding passing any useRef into the
  // panResponder initializer (which react-hooks/refs flags as render-time
  // ref access).
  const [dismissCount, setDismissCount] = useState(0);

  const amountInputRef = useRef<TextInput>(null);

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
  const { control, handleSubmit, reset, setError, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: '', budget: '' },
  });

  useEffect(() => {
    if (!visible) {
      dragY.setValue(0);
      return;
    }
    dragY.setValue(600);
    Animated.spring(dragY, { toValue: 0, useNativeDriver: true, tension: 68, friction: 12 }).start();

    if (editMode) {
      reset({ name: editMode.initialValues.name, budget: editMode.initialValues.budget ? String(editMode.initialValues.budget) : '' });
      dispatch({ kind: 'open_edit', editMode });
    } else {
      reset({ name: '', budget: '' });
      dispatch({ kind: 'open_add', defaultType, defaultCategoryId, defaultExpenseId, initialDate: defaultDateForMonth(month) });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ── Data ──────────────────────────────────────────────────────────────────
  const { data: categories } = useCategoriesForMonth(projectId, selectedMonth);
  const activeCategories = (categories ?? []).filter(c => !c.isArchived);

  const { data: expenses } = useExpensesForMonth(
    projectId,
    modal.selectedCategoryId ?? '',
    selectedMonth,
  );

  const selectedCatIdx = activeCategories.findIndex(c => c.id === modal.selectedCategoryId);
  const selectedCat    = selectedCatIdx >= 0 ? activeCategories[selectedCatIdx] : null;
  const selectedExp    = modal.selectedExpenseId
    ? ((expenses ?? []).find(e => e.id === modal.selectedExpenseId) ?? null)
    : null;

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createIncome   = useCreateIncome(projectId, selectedMonth);
  const createExpense  = useCreateExpense(projectId, modal.selectedCategoryId ?? '', selectedMonth);
  const addExpenseItem = useAddExpenseItem(projectId, modal.selectedCategoryId ?? '', selectedMonth);

  const patchExpense = usePatchExpense(
    projectId,
    (editMode?.type === 'expense' || editMode?.type === 'expenseItem') ? (editMode.categoryId ?? '') : (modal.selectedCategoryId ?? ''),
    (editMode?.type === 'expense' || editMode?.type === 'expenseItem') ? editMode.id : '',
    selectedMonth,
  );
  const patchIncome = usePatchIncome(
    projectId,
    editMode?.type === 'income' ? editMode.id : '',
    selectedMonth,
  );

  const isPending =
    createIncome.isPending || createExpense.isPending ||
    addExpenseItem.isPending || patchExpense.isPending || patchIncome.isPending;

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleApiError = (error: unknown) => {
    const fieldErrors = extractApiErrors(error);
    const unmapped: string[] = [];
    let dateApiError: string | undefined;
    let amountApiError: string | undefined;

    for (const [key, messages] of Object.entries(fieldErrors)) {
      const first = messages[0];
      switch (key.toLowerCase()) {
        case 'name':
          setError('name', { type: 'server', message: first });
          break;
        case 'budget':
          setError('budget', { type: 'server', message: first });
          break;
        case 'date':
          dateApiError = first;
          break;
        case 'amount':
          amountApiError = first;
          break;
        default:
          unmapped.push(first);
      }
    }

    let apiError: string | undefined;
    if (unmapped.length > 0) {
      apiError = unmapped.join(' ');
    } else if (Object.keys(fieldErrors).length === 0) {
      apiError = t('ErrorGeneric') ?? 'Something went wrong. Please try again.';
    }

    dispatch({ kind: 'set_api_errors', dateApiError, amountApiError, apiError });
  };

  const onSubmit = (values: FormValues) => {
    const amount  = (parseInt(modal.amountText || '0', 10) / 100);
    const budget  = parseFloat(values.budget) || 0;
    const dateStr = toDateOnly(modal.date);
    const name    = values.name.trim();

    dispatch({ kind: 'set_api_errors', dateApiError: undefined, amountApiError: undefined, apiError: undefined });

    if (shouldShowAmountError(editMode, amount)) {
      dispatch({ kind: 'set_amount_error', error: true });
      return;
    }
    dispatch({ kind: 'set_amount_error', error: false });

    if (editMode) {
      if (editMode.type === 'expenseItem') {
        const idx = editMode.itemIndex ?? 0;
        patchExpense.mutate(
          buildExpenseItemPatch(idx, { name, amount, date: dateStr, isDeductible: modal.isDeductible }),
          {
            onSuccess: onClose,
            onError: (err) => {
              captureError(err, { screen: 'QuickAddModal', action: 'updateExpenseItem' });
              handleApiError(err);
            },
          },
        );
        return;
      }
      if (editMode.type === 'expense') {
        const fields: Record<string, unknown> = { name, date: dateStr, isDeductible: modal.isDeductible, budget };
        if (!editMode.hasItems) fields.amount = amount;
        patchExpense.mutate(buildPatch(fields), {
          onSuccess: onClose,
          onError: (err) => {
            captureError(err, { screen: 'QuickAddModal', action: 'updateExpense' });
            handleApiError(err);
          },
        });
      } else {
        // income: only patch name, amount, date — no isDeductible or budget
        patchIncome.mutate(buildPatch({ name, amount, date: dateStr } as Record<string, unknown>), {
          onSuccess: onClose,
          onError: (err) => {
            captureError(err, { screen: 'QuickAddModal', action: 'updateIncome' });
            handleApiError(err);
          },
        });
      }
      return;
    }

    if (modal.entryType === 'income') {
      createIncome.mutate({ name, amount, date: dateStr }, {
        onSuccess: onClose,
        onError: (err) => {
          captureError(err, { screen: 'QuickAddModal', action: 'createIncome' });
          handleApiError(err);
        },
      });
    } else if (modal.selectedExpenseId) {
      addExpenseItem.mutate(
        { expenseId: modal.selectedExpenseId, item: { name, amount, date: dateStr, isDeductible: modal.isDeductible } as never },
        {
          onSuccess: onClose,
          onError: (err) => {
            captureError(err, { screen: 'QuickAddModal', action: 'addExpenseItem' });
            handleApiError(err);
          },
        },
      );
    } else {
      if (!modal.selectedCategoryId) return;
      createExpense.mutate(
        { name, amount, budget, isDeductible: modal.isDeductible, date: dateStr },
        {
          onSuccess: onClose,
          onError: (err) => {
            captureError(err, { screen: 'QuickAddModal', action: 'createExpense' });
            handleApiError(err);
          },
        },
      );
    }
  };

  const handleCategoryPress = (id: string) => {
    if (defaultCategoryId) return;
    dispatch({ kind: 'select_category', id: modal.selectedCategoryId === id ? null : id });
  };

  const handleAmountChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 9);
    dispatch({ kind: 'set_amount_text', text: digits });
    if (modal.amountError) dispatch({ kind: 'set_amount_error', error: false });
  };

  const amountCents = parseInt(modal.amountText || '0', 10);
  const amountIntPart = Math.floor(amountCents / 100).toString();
  const amountDecPart = String(amountCents % 100).padStart(2, '0');

  // ── Design tokens ─────────────────────────────────────────────────────────
  const panelBg     = dark ? '#061e33' : '#e8f4fe';
  const panelBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.92)';
  const chipBg      = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.7)';
  const chipBorder  = dark ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.85)';
  const toggleBg    = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';

  const isEditMode = !!editMode;
  const isLocked   = isEditMode || !!defaultCategoryId || !!defaultExpenseId;
  const canSubmit  = isEditMode || modal.entryType === 'income' || !!modal.selectedCategoryId;
  const amountIsReadonly = isEditMode && editMode.hasItems;

  const amountColor = modal.entryType === 'income' ? '#14c08a' : '#e74c3c';

  const title = isEditMode
    ? (() => {
        if (editMode.type === 'income') return t('LabelEditIncome') ?? 'Edit income';
        if (editMode.type === 'expenseItem') return t('LabelEditExpenseItem') ?? 'Edit item';
        return t('LabelEditExpense') ?? 'Edit expense';
      })()
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
        style={styles.kavWrap}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.panel,
            { backgroundColor: panelBg, borderColor: panelBorder, height: panelH },
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
            automaticallyAdjustKeyboardInsets
            contentContainerStyle={styles.scrollContent}
          >
            {/* API error banner */}
            <ErrorBanner
              visible={!!modal.apiError}
              message={modal.apiError}
              onDismiss={() => dispatch({ kind: 'set_api_errors', dateApiError: modal.dateApiError, amountApiError: modal.amountApiError, apiError: undefined })}
            />

            {/* Header */}
            <Text style={[styles.title, { color: ink }]}>{title}</Text>

            {/* Project name tag */}
            {selectedProject && (
              <View style={styles.projectTag}>
                <MaterialCommunityIcons name="folder-outline" size={12} color={ink2} />
                <Text style={[styles.projectTagLabel, { color: ink2 }]}>
                  {selectedProject.project.name}
                </Text>
              </View>
            )}

            {/* Type toggle — above the amount */}
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
                          colors={opt === 'income' ? ['#0e9f6e', '#14c08a'] : ['#e74c3c', '#c0392b']}
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

            {/* Amount hero — integer + smaller decimal, hidden input */}
            <Pressable
              style={[styles.amountHero, amountIsReadonly && { opacity: 0.6 }]}
              onPress={() => !amountIsReadonly && amountInputRef.current?.focus()}
            >
              <Text style={[styles.amountHeroLabel, { color: ink2 }]}>
                {t('FieldAmount') ?? 'Amount'}
              </Text>
              <View style={styles.amountHeroRow}>
                <Text style={[styles.amountHeroSym, { color: amountColor }]}>
                  {sym}
                </Text>
                <Text style={[styles.amountHeroInt, { color: amountColor }]}>
                  {amountIntPart}
                </Text>
                <Text style={[styles.amountHeroDec, { color: amountColor }]}>
                  {amountDecPart}
                </Text>
              </View>
              {!amountIsReadonly && (
                <TextInput
                  ref={amountInputRef}
                  value={modal.amountText}
                  onChangeText={handleAmountChange}
                  keyboardType="number-pad"
                  caretHidden
                  accessible={false}
                  importantForAccessibility="no"
                  style={styles.hiddenAmountInput}
                />
              )}
              {modal.amountError && (
                <HelperText type="error" style={styles.amountHeroError}>
                  {t('RequiredField') ?? 'Required'}
                </HelperText>
              )}
              {modal.amountApiError && (
                <HelperText type="error" style={styles.amountHeroError}>
                  {modal.amountApiError}
                </HelperText>
              )}
            </Pressable>

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

            {/* Budget info card — appears once a category or expense is selected */}
            {!isEditMode && modal.entryType === 'expense' && (selectedCat || selectedExp) && (() => {
              const isCat    = !selectedExp;
              const label    = selectedExp ? selectedExp.name : selectedCat!.name;
              const icon     = getCategoryIcon(label) as never;
              const spent    = selectedExp ? selectedExp.amount : selectedCat!.expenses?.reduce((sum, e) => sum + e.amount, 0);
              const budget   = selectedExp ? selectedExp.budget : selectedCat!.expenses?.reduce((sum, e) => sum + e.budget, 0);
              const color    = isCat ? getCategoryColor(selectedCatIdx) : '#0f76a8';
              const hasBudget = budget > 0;
              const pct       = hasBudget ? Math.min(spent / budget, 1) : 0;
              const over      = hasBudget && spent > budget;
              const barColor  = over ? '#e74c3c' : color;
              const remaining = Math.abs(budget - spent);
              return (
                <View style={[styles.budgetCard, { backgroundColor: chipBg, borderColor: chipBorder }]}>
                  <View style={styles.budgetCardRow}>
                    <MaterialCommunityIcons name={icon} size={14} color={color} />
                    <Text style={[styles.budgetCardName, { color: ink }]} numberOfLines={1}>{label}</Text>
                    <Text style={[styles.budgetCardSpent, { color: over ? '#e74c3c' : ink }]}>
                      {sym}{spent?.toFixed(2)}
                    </Text>
                  </View>
                  {hasBudget && (
                    <>
                      <View style={[styles.budgetTrack, { backgroundColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)' }]}>
                        <View style={[styles.budgetFill, { backgroundColor: barColor, width: `${Math.round(pct * 100)}%` as never }]} />
                      </View>
                      <View style={styles.budgetCardFooter}>
                        <Text style={[styles.budgetPct, { color: over ? '#e74c3c' : ink2 }]}>
                          {Math.round(pct * 100)}% {t('LabelOfBudget') ?? 'of budget'}
                        </Text>
                        <Text style={[styles.budgetRemaining, { color: over ? '#e74c3c' : ink2 }]}>
                          {sym}{remaining?.toFixed(2)} {over ? (t('LabelOver') ?? 'over') : (t('LabelLeft') ?? 'left')}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              );
            })()}

            {/* Fields */}
            <View style={[styles.fieldsDivider, { borderTopColor: hair }]} />

            <Controller control={control} name="name"
              rules={{ required: isNameRequired(editMode, !!modal.selectedExpenseId) ? (t('RequiredField') ?? 'Required') : false }}
              render={({ field: { onChange, value } }) => (
                <AuroraField dark={dark} icon="text-short"
                  placeholder={modal.selectedExpenseId ? (t('PlaceholderItemWithoutName') ?? 'Item') : (t('FieldName') ?? 'Name')}
                  value={value} onChangeText={onChange} hasError={!!errors.name} />
              )}
            />
            {errors.name && <HelperText type="error" style={styles.helperText}>{errors.name.message}</HelperText>}

            {/* Budget — expense only, not when adding an item or editing an expense item */}
            {(modal.entryType === 'expense' || isEditMode) && editMode?.type !== 'income' && editMode?.type !== 'expenseItem' && !modal.selectedExpenseId && (
              <>
                <Controller control={control} name="budget"
                  render={({ field: { onChange, value } }) => (
                    <AuroraField dark={dark} icon="bullseye-arrow" textPrefix={sym || undefined}
                      placeholder={`${t('FieldBudget') ?? 'Budget'} (${t('Optional') ?? 'optional'})`}
                      value={value} onChangeText={onChange} keyboardType="decimal-pad" hasError={!!errors.budget} />
                  )}
                />
                {errors.budget && <HelperText type="error" style={styles.helperText}>{errors.budget.message}</HelperText>}
              </>
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
                    dispatch({ kind: 'set_api_errors', dateApiError: undefined, amountApiError: modal.amountApiError, apiError: modal.apiError });
                  } else {
                    dispatch({ kind: 'close_date_picker' });
                  }
                }}
              />
            )}
            {modal.dateApiError && (
              <HelperText type="error" style={styles.helperText}>{modal.dateApiError}</HelperText>
            )}

            {/* Deductible toggle */}
            {(modal.entryType === 'expense' || isEditMode) && editMode?.type !== 'income' && (
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
  },
  handleWrap: { paddingTop: 14, paddingBottom: 10, alignItems: 'center' },
  handle: { width: 40, height: 4, borderRadius: 2 },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 44 },

  title: { fontSize: 19, fontWeight: '800', marginBottom: 6 },

  projectTag: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 18 },
  projectTagLabel: { fontSize: 12, fontWeight: '600' },

  amountHero: { alignItems: 'center', paddingVertical: 12, marginBottom: 10 },
  amountHeroLabel: {
    fontSize: 11, fontWeight: '700', letterSpacing: 0.8,
    textTransform: 'uppercase', marginBottom: 6,
  },
  amountHeroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 1 },
  amountHeroSym: { fontSize: 24, fontWeight: '600', paddingBottom: 6, includeFontPadding: false } as never,
  amountHeroInt: {
    fontSize: 52, fontWeight: '800', letterSpacing: -1,
    padding: 0, includeFontPadding: false, minWidth: 30,
  } as never,
  amountHeroDec: {
    fontSize: 26, fontWeight: '700', letterSpacing: -0.5,
    paddingBottom: 6, includeFontPadding: false,
  } as never,
  hiddenAmountInput: {
    position: 'absolute', width: 1, height: 1, opacity: 0,
  },
  amountHeroError: { marginTop: 2, textAlign: 'center' },

  typeToggle: { flexDirection: 'row', borderRadius: 16, borderWidth: 1, padding: 4, marginBottom: 14, gap: 4 },
  typeBtn:  { flex: 1 },
  typePill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, paddingVertical: 10 },
  typeLabelActive: { color: '#fff', fontWeight: '800', fontSize: 14 },
  typeLabel:       { fontWeight: '700', fontSize: 14 },

  sectionLabel: { fontSize: 12, fontWeight: '700', marginBottom: 8 },
  chipsScroll: { marginBottom: 16 },
  chipsRow:    { flexDirection: 'row', gap: 8, paddingVertical: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 22, borderWidth: 1, maxWidth: 160 },
  chipLabel: { fontSize: 12.5, fontWeight: '600' },

  budgetCard:       { borderRadius: 14, borderWidth: 1, padding: 12, marginBottom: 14 },
  budgetCardRow:    { flexDirection: 'row', alignItems: 'center', gap: 7 },
  budgetCardName:   { flex: 1, fontSize: 13, fontWeight: '700' },
  budgetCardSpent:  { fontSize: 13.5, fontWeight: '800' },
  budgetTrack:      { height: 4, borderRadius: 2, marginTop: 9, overflow: 'hidden' },
  budgetFill:       { height: 4, borderRadius: 2 },
  budgetCardFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  budgetPct:        { fontSize: 11, fontWeight: '600' },
  budgetRemaining:  { fontSize: 11, fontWeight: '600' },

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
