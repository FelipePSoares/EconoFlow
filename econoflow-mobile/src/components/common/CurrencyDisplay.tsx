import React from 'react';
import { Text, TextStyle } from 'react-native';
import { useTheme } from 'react-native-paper';
import { formatCurrency } from '../../utils/currency';

interface Props {
  amount: number;
  currency: string;
  style?: TextStyle;
}

export const CurrencyDisplay: React.FC<Props> = ({ amount, currency, style }) => {
  const theme = useTheme();
  return (
    <Text style={[{ color: theme.colors.onSurface }, style]}>
      {formatCurrency(amount, currency)}
    </Text>
  );
};
