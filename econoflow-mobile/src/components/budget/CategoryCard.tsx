import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Category } from '../../api/types';
import { getCategoryColor } from '../../utils/categoryTheme';
import { getCategoryIcon } from '../../utils/categoryIcon';
import { getCurrencySymbol } from '../../utils/currency';
import { calculateExpensesOverspend } from '../../utils/budget';
import { GlassCard } from '../common/GlassCard';
import { DonutRing } from '../common/DonutRing';
import { SwipeableRow } from '../common/SwipeableRow';
import { auroraTokens } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';

interface Props {
  category: Category;
  currency: string;
  onPress: () => void;
  index?: number;
  dark?: boolean;
  onSwipeAction?: () => void;
  swipeActionColor?: string;
  swipeDisabled?: boolean;
}

const getTotalSpend  = (cat: Category): number =>
  cat.expenses.reduce((s, e) => s + e.amount, 0);
const getTotalBudget = (cat: Category): number =>
  cat.expenses.reduce((s, e) => s + e.budget, 0);

export const CategoryCard: React.FC<Props> = ({
  category, currency, onPress, index = 0, dark,
  onSwipeAction, swipeActionColor, swipeDisabled,
}) => {
  const { t }  = useTranslation();
  const { ink, ink2 } = auroraTokens(!!dark);
  const { colors } = useAppTheme();
  const spent       = getTotalSpend(category);
  const budget      = getTotalBudget(category);
  const pct         = budget > 0 ? spent / budget : 0;
  const isOver      = pct > 1;
  const catOverspend = calculateExpensesOverspend(category.expenses);
  const color       = getCategoryColor(index);
  const sym         = getCurrencySymbol(currency);
  const icon        = getCategoryIcon(category.name);

  const rowContent = (
    <TouchableOpacity onPress={onPress} activeOpacity={0.78}>
      <View style={styles.row}>
        <DonutRing
          size={46}
          strokeWidth={6}
          progress={pct}
          color={isOver ? colors.error : color}
          trackColor={dark ? color + '33' : color + '28'}
        >
          <MaterialCommunityIcons name={icon as never} size={17} color={isOver ? colors.error : color} />
        </DonutRing>

        <View style={styles.info}>
          <Text style={[styles.name, { color: ink }]}>{category.name}</Text>
          <Text style={[styles.sub, { color: isOver ? colors.error : ink2 }]}>
            {category.expenses.length} {t('LabelExpenseItems')} · {Math.round(pct * 100)}%
          </Text>
          {catOverspend > 0 && (
            <Text style={[styles.overspend, { color: colors.error }]}>
              +{sym} {Math.round(catOverspend).toLocaleString()} {t('LabelOver') ?? 'over'}
            </Text>
          )}
        </View>

        <Text style={[styles.amount, { color: ink }]}>
          {sym} {Math.round(spent).toLocaleString()}
        </Text>
        <MaterialCommunityIcons name="chevron-right" size={18} color={ink2} />
      </View>
    </TouchableOpacity>
  );

  return (
    <GlassCard dark={!!dark} radius={18} intensity={30} style={styles.wrapper}>
      {onSwipeAction ? (
        <SwipeableRow
          disabled={!!swipeDisabled}
          actionIcon="archive-outline"
          actionColor={swipeActionColor ?? ink2}
          onAction={onSwipeAction}
        >
          {rowContent}
        </SwipeableRow>
      ) : (
        rowContent
      )}
    </GlassCard>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginVertical: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  info:     { flex: 1, gap: 3 },
  name:     { fontSize: 14.5, fontWeight: '700' },
  sub:      { fontSize: 11.5 },
  overspend:{ fontSize: 11.5, fontWeight: '700' },
  amount:   { fontSize: 14, fontWeight: 'bold' },
});
