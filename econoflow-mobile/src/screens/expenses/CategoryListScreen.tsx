import React, { useState, useEffect } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View, RefreshControl } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useQuickAddStore } from '../../store/quickAddStore';
import { useCategoriesForMonth } from '../../hooks/useCategories';
import { CategoryCard } from '../../components/budget/CategoryCard';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { MonthNavigator } from '../../components/common/MonthNavigator';
import { GlassScreen } from '../../components/common/GlassScreen';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

type Props = NativeStackScreenProps<OverviewStackParamList, 'CategoryList'>;

export const CategoryListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(route.params.month);
  const [dismissedError, setDismissedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const { selectedProject, currency } = useProjectStore();

  const setViewedMonth = useQuickAddStore(s => s.setViewedMonth);
  const isFocused = useIsFocused();
  useEffect(() => {
    setViewedMonth(isFocused ? month : null);
  }, [month, isFocused, setViewedMonth]);
  const projectId = selectedProject?.project.id ?? '';

  const { data: categories, isLoading, isFetching, isError, refetch } =
    useCategoriesForMonth(projectId, month);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  if (isLoading) return <LoadingIndicator />;

  const activeCategories = categories?.filter(c => !c.isArchived) ?? [];

  return (
    <GlassScreen dark={dark}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBtn, { borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)' }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={ink} />
        </TouchableOpacity>
        <Text style={[styles.headerName, { color: ink }]}>{t('LabelCategories') ?? 'Categories'}</Text>
        {/* Spacer keeps title centred */}
        <View style={styles.headerBtn} />
      </View>

      <MonthNavigator month={month} onChange={setMonth} dark={dark} />

      {isError && !dismissedError && (
        <ErrorBanner
          visible
          message={t('ErrorGeneric')}
          onDismiss={() => setDismissedError(true)}
        />
      )}

      <FlatList
        style={{ opacity: isFetching && !!categories ? 0.55 : 1 }}
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
                categoryIndex: index,
              })
            }
          />
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: ink2 }]}>{t('LabelNoCategories')}</Text>
        }
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ink2} />
        }
      />
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    borderColor: 'transparent',
  },
  headerName: { fontSize: 17, fontWeight: '800' },
  list: { paddingTop: 8, paddingBottom: 24 },
  empty: { textAlign: 'center', marginTop: 48, fontSize: 14, opacity: 0.6 },
});
