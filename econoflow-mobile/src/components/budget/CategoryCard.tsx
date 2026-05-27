import React from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Card, Text } from 'react-native-paper';
import type { Category } from '../../api/types';
import { BudgetProgressBar } from './BudgetProgressBar';

interface Props {
  category: Category;
  currency: string;
  onPress: () => void;
}

const getTotalSpend = (category: Category): number =>
  category.expenses.reduce((sum, e) => sum + Math.min(e.amount, e.budget > 0 ? e.budget : e.amount), 0);

const getTotalBudget = (category: Category): number =>
  category.expenses.reduce((sum, e) => sum + e.budget, 0);

export const CategoryCard: React.FC<Props> = ({ category, currency, onPress }) => {
  const spent = getTotalSpend(category);
  const budget = getTotalBudget(category);

  return (
    <TouchableOpacity onPress={onPress}>
      <Card style={styles.card}>
        <Card.Content style={styles.content}>
          <Text variant="titleSmall" style={styles.name}>
            {category.name}
          </Text>
          <BudgetProgressBar spent={spent} budget={budget} currency={currency} />
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: { marginVertical: 4, marginHorizontal: 16 },
  content: { gap: 8 },
  name: { fontWeight: '600' },
});
