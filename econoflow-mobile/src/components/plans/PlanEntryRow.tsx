import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { PlanEntry } from '../../api/types';
import { getCurrencySymbol } from '../../utils/currency';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';

interface Props {
  entry: PlanEntry;
  currency?: string;
}

export const PlanEntryRow: React.FC<Props> = ({ entry, currency = 'EUR' }) => {
  const { t } = useTranslation();
  const { ink, ink2 } = useAuroraSkin();
  const { customColors } = useAppTheme();
  const sym = getCurrencySymbol(currency);
  const isDeposit = entry.amountSigned > 0;
  const amountColor = isDeposit ? customColors.income : customColors.expense;
  const amountText = isDeposit
    ? `+${sym} ${entry.amountSigned.toLocaleString()}`
    : `${sym} ${entry.amountSigned.toLocaleString()}`;

  return (
    <View style={styles.row}>
      <View style={styles.info}>
        <Text style={[styles.date, { color: ink }]}>{entry.date}</Text>
        <Text style={[styles.note, { color: ink2 }]}>
          {entry.note ? entry.note : t('PlanEntryNoNote')}
        </Text>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>{amountText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  row:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  info:   { flex: 1, gap: 2 },
  date:   { fontSize: 13.5, fontWeight: '600' },
  note:   { fontSize: 11.5 },
  amount: { fontSize: 14.5, fontWeight: '700' },
});
