import React from 'react';
import { View, StyleSheet } from 'react-native';
import { IconButton, Text, useTheme } from 'react-native-paper';
import { formatMonthLabel, prevMonth, nextMonth } from '../../utils/date';

interface Props {
  month: string;
  onChange: (month: string) => void;
  light?: boolean;
}

export const MonthNavigator: React.FC<Props> = ({ month, onChange, light }) => {
  const theme = useTheme();
  const color = light ? '#ffffff' : theme.colors.onSurface;

  return (
    <View style={styles.container}>
      <IconButton icon="chevron-left" iconColor={color} onPress={() => onChange(prevMonth(month))} />
      <Text variant="titleMedium" style={[styles.label, { color }]}>
        {formatMonthLabel(month)}
      </Text>
      <IconButton icon="chevron-right" iconColor={color} onPress={() => onChange(nextMonth(month))} />
    </View>
  );
};

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
