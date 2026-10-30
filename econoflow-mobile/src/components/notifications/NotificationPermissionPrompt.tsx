import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { AuroraPrimaryButton } from '../auth/AuroraPrimaryButton';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';
import { openNotificationSettings } from '../../hooks/usePushNotifications';
import { useNotificationPermissionPrompt } from '../../hooks/useNotificationPermissionPrompt';

/**
 * The pre-permission rationale (#1053).
 *
 * Shown on top of the first post-login screen instead of firing the OS dialog blind: the
 * copy explains what the alerts are for, and "Not now" is recorded as an answer so the
 * next login does not nag. Once the OS refuses for good, the app can no longer ask, so the
 * same component switches to guidance that points at the system settings.
 *
 * It renders nothing when neither case applies — it is mounted once by `MainNavigator`
 * rather than conditionally by each screen.
 *
 * Deliberately not built on `GlassCard`: that component is a detail-screen panel that
 * expects the screen underneath to own the blur, while this one floats above the tab
 * navigator as its own surface (Material `surface` + elevation).
 */
export const NotificationPermissionPrompt: React.FC = () => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const theme = useAppTheme();
  const {
    shouldShowRationale,
    permissionDenied,
    request,
    dismissPermissionDenied,
  } = useNotificationPermissionPrompt();

  if (!shouldShowRationale && !permissionDenied) {
    return null;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none" testID="notifications-permission-card">
      <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
        <View style={styles.row}>
          <View
            style={[styles.iconWrap, { backgroundColor: theme.colors.primary + (dark ? '2E' : '1A') }]}
          >
            <MaterialCommunityIcons name="bell-ring-outline" size={22} color={theme.colors.primary} />
          </View>
          <Text style={[styles.title, { color: ink }]}>
            {t(
              shouldShowRationale
                ? 'NotificationsPermissionRationaleTitle'
                : 'NotificationsPermissionBlockedTitle',
            )}
          </Text>
        </View>

        {shouldShowRationale ? (
          <>
            <Text
              style={[styles.message, { color: ink2 }]}
              testID="notification-permission-rationale"
            >
              {t('NotificationsPermissionRationaleMessage')}
            </Text>
            <AuroraPrimaryButton
              testID="NotificationsPermissionAllow"
              label={t('NotificationsPermissionAllow')}
              onPress={() => { void request(); }}
              icon="bell-check-outline"
            />
            <TouchableOpacity
              testID="NotificationsPermissionNotNow"
              onPress={dismissPermissionDenied}
              style={styles.secondary}
            >
              <Text style={[styles.secondaryText, { color: ink2 }]}>
                {t('NotificationsPermissionNotNow')}
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text
              style={[styles.message, { color: ink2 }]}
              testID="notification-permission-denied"
            >
              {t('NotificationsPermissionDeniedGuidance')}
            </Text>
            <AuroraPrimaryButton
              testID="NotificationsPermissionOpenSettings"
              label={t('NotificationsPermissionOpenSettings')}
              onPress={openNotificationSettings}
              icon="cog-outline"
            />
            <TouchableOpacity
              testID="NotificationPermissionDismiss"
              onPress={dismissPermissionDenied}
              style={styles.secondary}
            >
              <Text style={[styles.secondaryText, { color: ink2 }]}>
                {t('ButtonDismiss')}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    padding: 16,
  },
  card: {
    padding: 20,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(13,33,55,0.08)',
    elevation: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 17, fontWeight: '800' },
  message: { fontSize: 13.5, lineHeight: 20 },
  secondary: { alignItems: 'center', paddingVertical: 12 },
  secondaryText: { fontSize: 13.5, fontWeight: '700' },
});
