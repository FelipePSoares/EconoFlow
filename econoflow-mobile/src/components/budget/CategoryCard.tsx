import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { Category } from '../../api/types';
import { getCategoryColor } from '../../utils/categoryTheme';
import { GlassCard } from '../common/GlassCard';
import { auroraTokens } from '../../theme/useAuroraSkin';

interface Props {
  category: Category;
  currency: string;
  onPress: () => void;
  index?: number;
  dark?: boolean;
}

const getTotalSpend  = (cat: Category): number =>
  cat.expenses.reduce((s, e) => s + e.amount, 0);
const getTotalBudget = (cat: Category): number =>
  cat.expenses.reduce((s, e) => s + e.budget, 0);

export const CategoryCard: React.FC<Props> = ({
  category, currency, onPress, index = 0, dark,
}) => {
  const { t } = useTranslation();
  const { ink, ink2 } = auroraTokens(!!dark);
  const spent  = getTotalSpend(category);
  const budget = getTotalBudget(category);
  const pct    = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const color  = getCategoryColor(index);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.78} style={styles.wrapper}>
      <GlassCard dark={!!dark} radius={18} intensity={30}>
        <View style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: color + (dark ? '30' : '22') }]}>
            <MaterialCommunityIcons name="shape-outline" size={20} color={color} />
          </View>

          <View style={styles.info}>
            <Text style={[styles.name, { color: ink }]}>{category.name}</Text>
            <Text style={[styles.sub, { color: ink2 }]}>
              {category.expenses.length} {t('LabelExpenseItems')} · {Math.round(pct * 100)}%
            </Text>
            <View style={[styles.track, { backgroundColor: color + '22' }]}>
              <View style={[
                styles.fill,
                { width: `${Math.round(pct * 100)}%` as `${number}%`, backgroundColor: color },
              ]} />
            </View>
          </View>

          <Text style={[styles.amount, { color: '#e74c3c' }]}>
            {currency} {Math.round(spent).toLocaleString()}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={ink2} />
        </View>
      </GlassCard>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  wrapper: { marginHorizontal: 16, marginVertical: 5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  iconWrap: {
    width: 46, height: 46, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  info:   { flex: 1, gap: 3 },
  name:   { fontSize: 14.5, fontWeight: '700' },
  sub:    { fontSize: 11.5 },
  track:  { height: 4, borderRadius: 2, marginTop: 4, overflow: 'hidden' },
  fill:   { height: 4, borderRadius: 2 },
  amount: { fontSize: 14, fontWeight: 'bold' },
});
