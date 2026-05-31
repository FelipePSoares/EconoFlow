import React, { useState } from 'react';
import { FlatList, StyleSheet, View, RefreshControl, useColorScheme } from 'react-native';
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
import { AuroraMesh } from '../../components/common/AuroraMesh';

type Props = NativeStackScreenProps<OverviewStackParamList, 'CategoryList'>;

export const CategoryListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const dark = useColorScheme() === 'dark';
  const [month, setMonth] = useState(route.params.month);
  const [dismissedError, setDismissedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { selectedProject, currency } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';

  const { data: categories, isLoading, isError, refetch } = useCategoriesForMonth(projectId, month);

  const bg = dark ? '#061e33' : '#e6eff6';
  const ink2 = dark ? '#8aa0b6' : '#5b6b7c';

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <LoadingIndicator />;

  const activeCategories = categories?.filter(c => !c.isArchived) ?? [];

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <AuroraMesh dark={dark} />

      <MonthNavigator month={month} onChange={setMonth} dark={dark} />

      {isError && !dismissedError && (
        <ErrorBanner visible message={t('ErrorGeneric')} onDismiss={() => setDismissedError(true)} />
      )}

      <FlatList
        data={activeCategories}
        keyExtractor={item => item.id}
        renderItem={({ item, index }) => (
          <CategoryCard
            category={item}
            currency={currency}
            index={index}
            dark={dark}
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
          <Text style={[styles.empty, { color: ink2 }]}>{t('LabelNoCategories')}</Text>
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink2} />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  list:  { paddingBottom: 24, paddingTop: 8 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 14, opacity: 0.6 },
});
