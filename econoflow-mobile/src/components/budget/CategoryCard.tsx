import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { Category } from '../../api/types';
import { getCategoryColor } from '../../utils/categoryTheme';

interface Props {
  category: Category;
  currency: string;
  onPress: () => void;
  index?: number;
  dark?: boolean;
}

const getTotalSpend = (cat: Category): number =>
  cat.expenses.reduce((s, e) => s + e.amount, 0);
const getTotalBudget = (cat: Category): number =>
  cat.expenses.reduce((s, e) => s + e.budget, 0);

// Format number compactly: 1234.5 → "1.234" (no cents)
function fmt(n: number, currency: string): string {
  return `${currency} ${Math.round(n).toLocaleString('pt-BR')}`;
}

export const CategoryCard: React.FC<Props> = ({ category, currency, onPress, index = 0, dark }) => {
  const spent  = getTotalSpend(category);
  const budget = getTotalBudget(category);
  const pct    = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const color  = getCategoryColor(index);

  const ink   = dark ? '#e6edf3' : '#0d2137';
  const ink2  = dark ? '#8aa0b6' : '#5b6b7c';
  const cardBg = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.68)';
  const cardBorder = dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.8)';
  const trackColor = dark ? 'rgba(255,255,255,0.12)' : (color + '28');

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.78}>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        {/* Icon ring */}
        <View style={[styles.ringOuter, { backgroundColor: trackColor }]}>
          <View style={[styles.ringInner, { backgroundColor: color + (dark ? '33' : '22') }]}>
            <MaterialCommunityIcons name="shape-outline" size={20} color={color} />
          </View>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Text style={[styles.name, { color: ink }]}>{category.name}</Text>
          <Text style={[styles.sub, { color: ink2 }]}>
            {Math.round(pct * 100)}% · {category.expenses.length} itens
          </Text>
          {/* Progress track */}
          <View style={[styles.track, { backgroundColor: trackColor }]}>
            <View style={[styles.fill, { width: `${Math.round(pct * 100)}%`, backgroundColor: color }]} />
          </View>
        </View>

        {/* Amount + chevron */}
        <View style={styles.right}>
          <Text style={[styles.amount, { color: ink }]}>{fmt(spent, currency)}</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={ink2} style={{ marginTop: 1 }} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginVertical: 5,
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: 'rgba(15,74,106,0.08)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 3,
  },
  ringOuter: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ringInner: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  info:   { flex: 1, gap: 3 },
  name:   { fontSize: 14.5, fontWeight: '700' },
  sub:    { fontSize: 11.5 },
  track:  { height: 5, borderRadius: 3, marginTop: 4, overflow: 'hidden' },
  fill:   { height: 5, borderRadius: 3 },
  right:  { flexDirection: 'row', alignItems: 'center', gap: 2 },
  amount: { fontSize: 14, fontWeight: '800' },
});
