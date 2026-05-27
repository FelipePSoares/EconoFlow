import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { formatMonthLabel, prevMonth, nextMonth } from '../../utils/date';

interface Props {
  month: string;
  onChange: (month: string) => void;
}

export const MonthNavigator: React.FC<Props> = ({ month, onChange }) => (
  <View style={styles.container}>
    <IconButton icon="chevron-left" onPress={() => onChange(prevMonth(month))} />
    <Text variant="titleMedium" style={styles.label}>
      {formatMonthLabel(month)}
    </Text>
    <IconButton icon="chevron-right" onPress={() => onChange(nextMonth(month))} />
  </View>
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    minWidth: 160,
    textAlign: 'center',
  },
});
