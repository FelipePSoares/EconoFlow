import React from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  RefreshControl,
} from 'react-native';
import { Text, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { GlassScreen } from '../../components/common/GlassScreen';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';
import { useNotifications, useMarkAsRead, useMarkAllAsRead } from '../../hooks/useNotifications';
import type { AppNotification } from '../../api/types';

const CATEGORY_ICONS: Record<string, string> = {
  Finance: 'currency-usd',
  Security: 'shield-lock-outline',
  Collaboration: 'account-group-outline',
  System: 'cog-outline',
};

interface Props {
  navigation: { goBack: () => void };
}

export const NotificationListScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2, hair } = useAuroraSkin();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = React.useState(false);

  const { data: notifications = [], isLoading, isError, refetch } = useNotifications();
  const [errorDismissed, setErrorDismissed] = React.useState(false);
  const { mutate: markAsRead } = useMarkAsRead();
  const { mutate: markAllAsRead } = useMarkAllAsRead();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const parseMetadata = (raw: string): Record<string, string> => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        return parsed as Record<string, string>;
    } catch {
      // ignore malformed metadata
    }
    return {};
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    const icon = CATEGORY_ICONS[item.category] ?? 'bell-outline';
    const params = item.metadata ? parseMetadata(item.metadata) : undefined;
    return (
      <TouchableOpacity
        style={[styles.item, { borderBottomColor: hair }]}
        onPress={() => markAsRead(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={icon as never}
            size={22}
            color={theme.colors.primary}
          />
        </View>
        <Text style={[styles.message, { color: ink }]}>{t(item.codeMessage, params)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <GlassScreen dark={dark}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={navigation.goBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={ink} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: ink }]}>{t('NotificationCentre')}</Text>
        <IconButton
          icon="check-all"
          iconColor={theme.colors.primary}
          size={22}
          onPress={() => markAllAsRead()}
          testID="mark-all-read-btn"
        />
      </View>

      <ErrorBanner
        visible={isError && !errorDismissed}
        onDismiss={() => setErrorDismissed(true)}
      />

      {isLoading ? (
        <LoadingIndicator />
      ) : notifications.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="bell-check-outline" size={48} color={ink2} />
          <Text style={[styles.emptyText, { color: ink2 }]}>{t('NoNotifications')}</Text>
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconContainer: {
    width: 36,
    alignItems: 'center',
    marginRight: 12,
  },
  message: {
    flex: 1,
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
  },
});
