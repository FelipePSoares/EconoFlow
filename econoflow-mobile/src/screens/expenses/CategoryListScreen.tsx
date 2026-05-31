import React, { useState } from 'react';
import { FlatList, StyleSheet, View, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useCategoriesForMonth } from '../../hooks/useCategories';
import { CategoryCard } from '../../components/budget/CategoryCard';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { MonthNavigator } from '../../components/common/MonthNavigator';

type Props = NativeStackScreenProps<OverviewStackParamList, 'CategoryList'>;

export const CategoryListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const [month, setMonth] = useState(route.params.month);
  const [dismissedError, setDismissedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { selectedProject, currency } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';

  const { data: categories, isLoading, isError, refetch } = useCategoriesForMonth(projectId, month);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <LoadingIndicator />;

  const activeCategories = categories?.filter((c) => !c.isArchived) ?? [];

  return (
    <View style={styles.container}>
      <MonthNavigator month={month} onChange={setMonth} />

      {isError && !dismissedError && (
        <ErrorBanner
          visible
          message={t('ErrorGeneric')}
          onDismiss={() => setDismissedError(true)}
        />
      )}

      <FlatList
        data={activeCategories}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CategoryCard
            category={item}
            currency={currency}
            onPress={() =>
              navigation.navigate('ExpenseList', {
                categoryId: item.id,
                categoryName: item.name,
                month,
              })
            }
          />
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('LabelNoCategories')}</Text>
        }
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { paddingBottom: 16 },
  empty: { textAlign: 'center', marginTop: 40, opacity: 0.5 },
});
