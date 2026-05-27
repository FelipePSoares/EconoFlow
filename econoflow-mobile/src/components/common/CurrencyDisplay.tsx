import React from 'react';
import { Text, TextStyle } from 'react-native';
import { formatCurrency } from '../../utils/currency';

interface Props {
  amount: number;
  currency: string;
  style?: TextStyle;
}

export const CurrencyDisplay: React.FC<Props> = ({ amount, currency, style }) => (
  <Text style={style}>{formatCurrency(amount, currency)}</Text>
);
