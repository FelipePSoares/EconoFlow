import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ProgressBar, Text, useTheme } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../../utils/currency';

interface Props {
  spent: number;
  budget: number;
  currency: string;
}

export const BudgetProgressBar: React.FC<Props> = ({ spent, budget, currency }) => {
  const theme = useTheme();
  const { t } = useTranslation();
  const progress = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const remaining = budget - spent;
  const isOver = remaining < 0;

  const barColor =
    progress >= 1 ? theme.colors.error : progress >= 0.7 ? '#f39c12' : theme.colors.primary;

  return (
    <View style={styles.container}>
      <ProgressBar progress={progress} color={barColor} style={styles.bar} />
      <View style={styles.row}>
        <Text variant="bodySmall">
          {formatCurrency(spent, currency)} / {formatCurrency(budget, currency)}
        </Text>
        <Text variant="bodySmall" style={{ color: isOver ? theme.colors.error : undefined }}>
          {isOver
            ? `${formatCurrency(Math.abs(remaining), currency)} ${t('LabelOver') ?? 'over'}`
            : `${formatCurrency(remaining, currency)} ${t('LabelRemaining') ?? 'remaining'}`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 4 },
  bar: { height: 6, borderRadius: 3 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
});
