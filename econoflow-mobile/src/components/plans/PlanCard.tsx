import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { Plan } from '../../api/types';
import { getCurrencySymbol } from '../../utils/currency';
import { GlassCard } from '../common/GlassCard';
import { DonutRing } from '../common/DonutRing';
import { SwipeableRow } from '../common/SwipeableRow';
import { auroraTokens } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';

interface Props {
  plan: Plan;
  currency?: string;
  onPress: () => void;
  dark?: boolean;
  onSwipeAction?: () => void;
  swipeDisabled?: boolean;
}

export const PlanCard: React.FC<Props> = ({
  plan, currency = 'EUR', onPress, dark,
  onSwipeAction, swipeDisabled,
}) => {
  const { t } = useTranslation();
  const { ink, ink2 } = auroraTokens(!!dark);
  const { colors, customColors } = useAppTheme();
  const sym = getCurrencySymbol(currency);
  const pct = Math.min(plan.progress, 1);
  const isComplete = pct >= 1;
  const ringColor = isComplete ? customColors.income : colors.primary;
  const trackColor = dark ? ringColor + '33' : ringColor + '28';
  const isSavings = plan.type === 'Savings';
  const badgeColor = isSavings ? colors.primary : colors.error;
  const badgeLabel = isSavings ? t('PlanTypeSaving') : t('PlanTypeEmergencyReserve');

  const rowContent = (
    <TouchableOpacity onPress={onPress} activeOpacity={0.78}>
      <View style={styles.row}>
        <DonutRing
          size={46}
          strokeWidth={6}
          progress={pct}
          color={ringColor}
          trackColor={trackColor}
        />
        <View style={styles.info}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: ink }]}>{plan.name}</Text>
            <View style={[styles.badge, { backgroundColor: badgeColor + '22', borderColor: badgeColor + '44' }]}>
              <Text style={[styles.badgeText, { color: badgeColor }]}>{badgeLabel}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <Text style={[styles.stat, { color: ink2 }]}>
              {t('PlanCurrent')}: {sym} {Math.round(plan.currentBalance).toLocaleString()}
            </Text>
            <Text style={[styles.stat, { color: ink2 }]}>
              {Math.round(pct * 100)}%
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <GlassCard dark={!!dark} radius={18} intensity={30} style={styles.wrapper}>
      {onSwipeAction ? (
        <SwipeableRow
          disabled={!!swipeDisabled}
          actionIcon="archive-outline"
          actionColor={ink2}
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
  wrapper:  { marginHorizontal: 16, marginVertical: 5 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  info:     { flex: 1, gap: 4 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:     { fontSize: 14.5, fontWeight: '700' },
  badge:    { borderRadius: 8, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText:{ fontSize: 10, fontWeight: '700' },
  statsRow: { flexDirection: 'row', gap: 12 },
  stat:     { fontSize: 11.5 },
});
