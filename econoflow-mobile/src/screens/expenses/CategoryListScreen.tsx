import React, { useState, useEffect } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useQuickAddStore } from '../../store/quickAddStore';
import { useCategoriesForMonth, useArchiveCategory, useUnarchiveCategory } from '../../hooks/useCategories';
import { CategoryCard } from '../../components/budget/CategoryCard';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { MonthNavigator } from '../../components/common/MonthNavigator';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { UndoToast } from '../../components/common/UndoToast';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';
import {
  calculateTotalBudget,
  calculateTotalExpenses,
  calculateTotalOverspend,
  calculateRemainingBudget,
} from '../../utils/budget';
import { getCurrencySymbol } from '../../utils/currency';
import { captureError } from '../../monitoring/sentry';

type Props = NativeStackScreenProps<OverviewStackParamList, 'CategoryList'>;

export const CategoryListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(route.params.month);
  const [dismissedError, setDismissedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [undoState, setUndoState] = useState<{ visible: boolean; id: string | null }>({ visible: false, id: null });
  const { selectedProject, currency } = useProjectStore();
  const canEdit = selectedProject?.role !== 'Viewer';

  const setViewedMonth = useQuickAddStore(s => s.setViewedMonth);
  const isFocused = useIsFocused();
  useEffect(() => {
    setViewedMonth(isFocused ? month : null);
  }, [month, isFocused, setViewedMonth]);
  const projectId = selectedProject?.project.id ?? '';

  const { data: categories, isLoading, isFetching, isError, error: categoriesError, refetch } =
    useCategoriesForMonth(projectId, month);
  const archiveCategory   = useArchiveCategory(projectId, month);
  const unarchiveCategory = useUnarchiveCategory(projectId, month);

  useEffect(() => {
    if (categoriesError) captureError(categoriesError, { screen: 'CategoryListScreen', action: 'fetchCategories' });
  }, [categoriesError]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <LoadingIndicator />;

  const activeCategories = categories?.filter(c => !c.isArchived) ?? [];
  const sym              = getCurrencySymbol(currency);
  const totalBudget      = calculateTotalBudget(activeCategories);
  const totalSpent       = calculateTotalExpenses(activeCategories);
  const totalOverspend   = calculateTotalOverspend(activeCategories);
  const remaining        = calculateRemainingBudget(activeCategories);
  const spentPct         = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  return (
    <GlassScreen dark={dark}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBtn, { borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)' }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={ink} />
        </TouchableOpacity>
        <Text style={[styles.headerName, { color: ink }]}>{t('LabelCategories') ?? 'Categories'}</Text>
        {/* Spacer keeps title centred */}
        <View style={styles.headerBtn} />
      </View>

      <MonthNavigator month={month} onChange={setMonth} dark={dark} />

      {isError && !dismissedError && (
        <ErrorBanner
          visible
          message={t('ErrorGeneric')}
          onDismiss={() => setDismissedError(true)}
        />
      )}

      <FlatList
        style={{ opacity: isFetching && !!categories ? 0.55 : 1 }}
        data={activeCategories}
        keyExtractor={item => item.id}
        ListHeaderComponent={
          activeCategories.length > 0 ? (
            <GlassCard dark={!!dark} radius={18} intensity={30} style={styles.summaryCard}>
              <View style={styles.summaryInner}>
                <Text style={[styles.summaryTitle, { color: ink2 }]}>{t('LabelBudgetSummary') ?? 'Budget Summary'}</Text>
                <View style={styles.summaryRow}>
                  <View style={styles.summaryStat}>
                    <Text style={[styles.summaryStatLabel, { color: ink2 }]}>{t('Budget')}</Text>
                    <Text style={[styles.summaryStatAmt, { color: ink }]}>
                      {sym} {Math.round(totalBudget).toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.summaryDivider, { backgroundColor: ink2 + '33' }]} />
                  <View style={styles.summaryStat}>
                    <Text style={[styles.summaryStatLabel, { color: ink2 }]}>
                      {t('LabelSpent') ?? 'spent'} · {spentPct}%
                    </Text>
                    <Text style={[styles.summaryStatAmt, { color: ink }]}>
                      {sym} {Math.round(totalSpent).toLocaleString()}
                    </Text>
                  </View>
                  <View style={[styles.summaryDivider, { backgroundColor: ink2 + '33' }]} />
                  <View style={styles.summaryStat}>
                    <Text style={[styles.summaryStatLabel, { color: ink2 }]}>{t('Remaining') ?? 'remaining'}</Text>
                    <Text style={[styles.summaryStatAmt, { color: ink }]}>
                      {sym} {Math.round(remaining).toLocaleString()}
                    </Text>
                    {totalOverspend > 0 && (
                      <Text style={[styles.summaryOverspend, { color: colors.error }]}>
                        +{sym} {Math.round(totalOverspend).toLocaleString()} {t('LabelOver') ?? 'over'}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            </GlassCard>
          ) : null
        }
        renderItem={({ item, index }) => (
          <CategoryCard
            category={item}
            currency={currency}
            index={index}
            dark={dark}
            onSwipeAction={() => {
              archiveCategory.mutate(item.id, {
                onError: (err) => captureError(err, { screen: 'CategoryListScreen', action: 'archiveCategory' }),
              });
              setUndoState({ visible: true, id: item.id });
            }}
            swipeActionColor={ink2}
            swipeDisabled={!canEdit}
            onPress={() =>
              navigation.navigate('ExpenseList', {
                categoryId: item.id,
                categoryName: item.name,
                month,
                categoryIndex: index,
              })
            }
          />
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: ink2 }]}>{t('LabelNoCategories')}</Text>
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink2} />
        }
      />

      <UndoToast
        visible={undoState.visible}
        message={t('LabelUndoArchive')}
        onUndo={() => {
          if (undoState.id) {
            unarchiveCategory.mutate(undoState.id, {
              onError: (err) => captureError(err, { screen: 'CategoryListScreen', action: 'unarchiveCategory' }),
            });
          }
        }}
        onDismiss={() => setUndoState({ visible: false, id: null })}
      />
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    borderColor: 'transparent',
  },
  headerName: { fontSize: 17, fontWeight: '800' },
  list: { paddingTop: 8, paddingBottom: 24 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 14, opacity: 0.6 },

  summaryCard:       { marginHorizontal: 16, marginTop: 4, marginBottom: 8 },
  summaryInner:      { padding: 14, gap: 8 },
  summaryTitle:      { fontSize: 11.5, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  summaryRow:        { flexDirection: 'row', alignItems: 'flex-start' },
  summaryStat:       { flex: 1, gap: 2 },
  summaryDivider:    { width: 1, marginHorizontal: 12, alignSelf: 'stretch' },
  summaryStatLabel:  { fontSize: 11, fontWeight: '600' },
  summaryStatAmt:    { fontSize: 15, fontWeight: 'bold' },
  summaryOverspend:  { fontSize: 11.5, fontWeight: '700' },
});
