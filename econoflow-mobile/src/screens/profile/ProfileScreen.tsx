import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, TouchableOpacity, View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import type { SessionParamList } from '../../navigation/SessionNavigator';
import { useAuthStore } from '../../store/authStore';
import { useBiometricStore } from '../../store/biometricStore';
import { useBiometricToggle } from '../../hooks/useBiometricToggle';
import type { BiometricFailure } from '../../hooks/useBiometricToggle';
import { usePinStore } from '../../store/pinStore';
import { useLockStore } from '../../store/lockStore';
import { useProjectStore } from '../../store/projectStore';
import { useNotificationStore } from '../../store/notificationStore';
import { usePushNotifications, requestNotificationPermissionAndRegister, openNotificationSettings } from '../../hooks/usePushNotifications';
import { useAppTheme } from '../../theme/useAppTheme';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { SECURITY_PAGE_URL } from '../../utils/legalLinks';

type Props = NativeStackScreenProps<ProfileStackParamList, 'Profile'>;

interface SettingRowProps {
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
  dark: boolean;
  ink: string;
  ink2: string;
  hair: string;
  iconColor?: string;
  isLast?: boolean;
  onPress?: () => void;
  testID?: string;
}

const SettingRow: React.FC<SettingRowProps> = ({
  icon, label, value, valueColor, iconColor, dark, ink, ink2, hair, isLast, onPress, testID,
}) => {
  const inner = (
    <View style={[styles.settingRow, { borderBottomColor: isLast ? 'transparent' : hair }]}>
      <View style={[styles.settingIconWrap, { backgroundColor: '#0f76a8' + (dark ? '28' : '18') }]}>
        <MaterialCommunityIcons name={icon as never} size={18} color={iconColor ?? '#0f76a8'} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: ink2 }]}>{label}</Text>
        <Text style={[styles.settingValue, { color: valueColor ?? ink }]}>{value}</Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={18} color={ink2} />
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} testID={testID}>
        {inner}
      </TouchableOpacity>
    );
  }

  return <View testID={testID}>{inner}</View>;
};

interface SettingToggleRowProps {
  icon: string;
  label: string;
  value: string;
  toggled: boolean;
  dark: boolean;
  ink: string;
  ink2: string;
  hair: string;
  disabled?: boolean;
  /**
   * Replaces the switch with an activity indicator while an async toggle is in
   * flight, so the row does not look frozen. Implies `disabled`.
   */
  loading?: boolean;
  isLast?: boolean;
  /**
   * Called with the value the row is asked to switch to. Resolving with `false` means the
   * change was refused, and the row takes back the value it already showed.
   */
  onToggle?: (next: boolean) => Promise<boolean> | void;
  testID?: string;
}

/**
 * How long after a change a second report of the same change is dropped.
 *
 * One physical touch on the Switch reaches the row as two events — the Switch's own
 * `onValueChange` and the wrapping Pressable's press — so the row has to collapse them
 * into one toggle (#1052). A fast second tap on the same value is far less likely than
 * that pair, and the very next tap on the row is enough to correct it.
 */
const TOGGLE_DEDUPE_MS = 400;

const SettingToggleRow: React.FC<SettingToggleRowProps> = ({
  icon, label, value, toggled, dark, ink, ink2, hair, disabled, loading, isLast, onToggle, testID,
}) => {
  // The Switch is told what the row now believes, so it moves with the tap instead of
  // waiting for the async store round trip and looking unresponsive.
  const [optimistic, setOptimistic] = useState(toggled);
  // The store value this row was last rendered from, so a new one can be adopted below.
  const [lastToggled, setLastToggled] = useState(toggled);
  const handledValueRef = useRef<{ value: boolean; at: number } | null>(null);
  // The value this row is waiting for the store to adopt, if any.
  const awaitingRef = useRef<boolean | null>(null);

  // The store's value is the truth whenever it changes. Adopting it during the render that
  // brings the new value (React's "adjust state from props" pattern) keeps the row in step
  // without an effect that would render twice.
  if (toggled !== lastToggled) {
    setLastToggled(toggled);
    setOptimistic(toggled);
  }

  const isBusy = !!loading;
  const isDisabled = isBusy || !!disabled;

  const requestToggle = (next: boolean) => {
    if (isDisabled || !onToggle) return;

    const handled = handledValueRef.current;
    if (handled && handled.value === next && Date.now() - handled.at < TOGGLE_DEDUPE_MS) {
      return;
    }
    handledValueRef.current = { value: next, at: Date.now() };

    awaitingRef.current = next;
    setOptimistic(next);
    void Promise.resolve(onToggle(next)).then((accepted) => {
      // A refused change never reaches the store, so `toggled` cannot correct the row:
      // take the optimistic value back, unless a newer tap has since asked for another.
      if (accepted === false && awaitingRef.current === next) {
        awaitingRef.current = null;
        setOptimistic(toggled);
      }
    });
  };

  const handleRowPress = () => {
    requestToggle(!optimistic);
  };

  const handleSwitchChange = (next: boolean) => {
    // The switch handed back the value it already shows: the row press that came with
    // it already moved it, so there is nothing left to toggle.
    if (next === optimistic) return;
    requestToggle(next);
  };

  return (
    <Pressable
      onPress={handleRowPress}
      disabled={isDisabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: optimistic, disabled: isDisabled, busy: isBusy }}
      testID={testID}
    >
      <View style={[styles.settingRow, { borderBottomColor: isLast ? 'transparent' : hair }]}>
        <View style={[styles.settingIconWrap, { backgroundColor: '#0f76a8' + (dark ? '28' : '18') }]}>
          <MaterialCommunityIcons name={icon as never} size={18} color="#0f76a8" />
        </View>
        <View style={styles.settingInfo}>
          <Text style={[styles.settingLabel, { color: ink2 }]}>{label}</Text>
          <Text style={[styles.settingValue, { color: ink }]}>{value}</Text>
        </View>
        {isBusy ? (
          <ActivityIndicator testID={`${testID}-spinner`} color="#0f76a8" />
        ) : (
          <Switch
            value={optimistic}
            disabled={isDisabled}
            onValueChange={handleSwitchChange}
            trackColor={{ false: hair, true: '#0f76a880' }}
            thumbColor={optimistic ? '#0f76a8' : '#ccc'}
            testID={`${testID}-switch`}
          />
        )}
      </View>
    </Pressable>
  );
};

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2, hair } = useAuroraSkin();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { user, clearAuth } = useAuthStore();
  const { clearProject, selectedProject } = useProjectStore();
  const { biometricEnabled } = useBiometricStore();
  const {
    isPending: isTogglingBiometrics,
    enabled: canToggleBiometrics,
    setBiometricEnabled,
  } = useBiometricToggle();
  const [biometricError, setBiometricError] = useState<BiometricFailure | null>(null);
  const { hasPin, clearPin } = usePinStore();
  const { reset: resetLock } = useLockStore();
  const rootNavigation = useNavigation<NativeStackNavigationProp<SessionParamList>>();
  const queryClient = useQueryClient();
  const {
    notificationsEnabled,
    pushPermissionStatus,
    canAskForPermission,
    isRegistering,
    isUnregistering,
    pushNotificationsError,
    unregisterPushNotifications,
    retryPushNotificationsRegistration,
    syncPermissionState,
    clearPushNotificationsError,
  } = usePushNotifications();

  const isTogglingNotifications = isRegistering || isUnregistering;

  // A failure from the shared flow (post-login prompt or the toggle) is stored next to
  // the permission state, so both entry points explain themselves through one banner.
  const lastPermissionError = useNotificationStore((s) => s.lastPermissionError);
  const clearLastPermissionError = useNotificationStore((s) => s.setLastPermissionError);
  // A declined OS prompt is an answer, not an error: the guidance row below explains the
  // way forward, and a "try again" banner would just re-ask a dialog the OS will ignore.
  const effectiveNotificationsError =
    pushNotificationsError ?? (lastPermissionError === 'permission' ? null : lastPermissionError);

  // The toggle must not claim ON while the OS blocks notifications: re-read the
  // permission on mount, since the user may have changed it in the system settings
  // while the app was backgrounded (#1053).
  useEffect(() => {
    void syncPermissionState();
    // `syncPermissionState` is recreated when the toggle flips; re-running it then would
    // re-register on every switch press, so only the mount is of interest here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignOut = async () => {
    // A failed unregister restores the token and the toggle so the Profile row stays
    // consistent; signing out then clears auth and the project anyway, so the leftover
    // subscription is never shown to the next user.
    await unregisterPushNotifications();
    queryClient.clear();
    clearPin();
    resetLock();
    clearAuth();
    clearProject();
  };

  // One tap on the push row, its label or its switch. The row hands over the value it is
  // asked to switch to; the flow below decides whether a dialog or a registration is
  // needed for it.
  const handleToggleNotifications = (next: boolean) => {
    if (isTogglingNotifications) return;
    // Turning it off is immediate; turning it on is an explicit request, so it goes
    // through the shared flow: the OS dialog is asked at most once and the Android
    // channel exists before it. A failure is surfaced by the flow through the banner
    // above; a decline is an answer, not an error, and is explained by the guidance.
    if (!next) {
      unregisterPushNotifications();
      return;
    }
    void requestNotificationPermissionAndRegister();
  };

  // Retrying a rejected registration is meaningful; retrying a failed disable is not,
  // so the banner only offers that action for the permission/device/network cases.
  // Guarded like the row itself: a fast double-tap must not start two registrations.
  const notificationsErrorRetry =
    effectiveNotificationsError && effectiveNotificationsError !== 'unregister' && !isTogglingNotifications
      ? retryPushNotificationsRegistration
      : undefined;

  // One tap on the biometric row, its label or its switch. The hook owns the
  // hardware/enrollment checks and joins taps that arrive together, so a double tap
  // cannot toggle twice. It resolves `false` when the change was refused, which tells the
  // row to take back the value it showed while waiting.
  const handleToggleBiometrics = async (next: boolean): Promise<boolean> => {
    setBiometricError(null);
    const result = await setBiometricEnabled(next);
    if (!result.ok && result.reason !== 'not-hydrated') setBiometricError(result.reason);
    return result.ok;
  };

  // Each reason has its own fix: no sensor at all, nothing enrolled yet, or a sensor that
  // could not answer. Sharing one sentence would send the user to the wrong screen.
  const biometricErrorMessage = (() => {
    switch (biometricError) {
      case 'hardware':
        return t('BiometricNotAvailable') ?? 'Biometrics not available on this device';
      case 'not-enrolled':
        return t('BiometricErrorNotEnrolled')
          ?? 'Set up a fingerprint or face unlock in your device settings first.';
      case 'unknown':
        return t('BiometricEnableFailed')
          ?? 'Couldn\'t enable biometric authentication. Please try again later.';
      default:
        return undefined;
    }
  })();

  // The OS will not show the dialog again, so the only remaining fix is the system
  // settings — unless the permission has since been granted there.
  const showPermissionGuidance =
    canAskForPermission === false && pushPermissionStatus !== 'granted';

  // Each failure gets its own wording: "try again later" is useless advice when the
  // OS has blocked the permission or the device cannot receive notifications at all.
  // A blocked permission gets the settings row below instead — showing the "try again"
  // banner with the same advice next to it would be two copies of one sentence.
  const notificationsErrorMessage = (() => {
    if (showPermissionGuidance) return undefined;
    switch (effectiveNotificationsError) {
      case 'permission':
        return t('NotificationsPermissionBlockedMessage') ?? 'Notifications are blocked for EconoFlow. Allow them in your device settings and try again.';
      case 'device':
        return t('NotificationsRequirePhysicalDeviceMessage') ?? 'Notifications need a physical device — this simulator cannot receive them.';
      case 'unavailable':
        return t('NotificationsUnavailableExpoGoMessage') ?? 'Push notifications are not available in Expo Go on Android. Use a development build.';
      case 'unregister':
        return t('NotificationsDisableFailedMessage') ?? 'Couldn\'t turn off notifications. Please try again later.';
      case 'api':
      case 'unknown':
        return t('NotificationsEnableFailedMessage') ?? 'Couldn\'t enable notifications. Please try again later.';
      default:
        return undefined;
    }
  })();

  // The support period and the Annex II instructions are published once, on
  // the site, so every delivery mode shows the same wording.
  const handleOpenSecurityPage = () => {
    void Linking.openURL(SECURITY_PAGE_URL);
  };

  const displayName = user?.fullName
    || `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()
    || user?.email?.split('@')[0]
    || '?';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <GlassScreen dark={dark}>
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + name */}
        <View style={styles.heroSection}>
          <TouchableOpacity
            onPress={() => navigation.navigate('EditName')}
            activeOpacity={0.7}
            testID="row-EditName"
            style={styles.avatarWrap}
          >
            <LinearGradient
              colors={['#0f76a8', '#14c08a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('EditName')} testID="row-EditName-name">
            <Text style={[styles.displayName, { color: ink }]}>{displayName}</Text>
          </TouchableOpacity>
          <Text style={[styles.email, { color: ink2 }]}>{user?.email}</Text>
          {selectedProject && (
            <View style={styles.projectPill}>
              <MaterialCommunityIcons name="folder-outline" size={13} color="#0f76a8" />
              <Text style={styles.projectPillText}>{selectedProject.project.name}</Text>
            </View>
          )}
        </View>

        {/* Account info */}
        <Text style={[styles.sectionTitle, { color: ink2 }]}>
          {t('LabelAccountInfo') ?? 'Account'}
        </Text>
        <GlassCard dark={dark} radius={20} style={styles.card}>
          <SettingRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="translate"
            label={t('LabelLanguage') ?? 'Language'}
            value={user?.languageCode ?? 'en'}
            onPress={() => navigation.navigate('LanguagePicker')}
            testID="row-LanguagePicker"
          />
          <SettingRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="email-outline"
            label={t('ChangeEmailAddress') ?? 'Email'}
            value={user?.email ?? ''}
            onPress={() => navigation.navigate('ChangeEmail')}
            testID="row-ChangeEmail"
          />
          <SettingRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="email-check-outline"
            label={t('EmailVerification') ?? 'Email Verification'}
            value={user?.emailConfirmed ? (t('EmailVerified') ?? 'Verified') : (t('EmailNotVerified') ?? 'Not verified')}
            valueColor={user?.emailConfirmed ? '#0e9f6e' : '#e74c3c'}
            isLast
          />
        </GlassCard>

        {/* Notifications */}
        <Text style={[styles.sectionTitle, { color: ink2 }]}>
          {t('NotificationPreferences') ?? 'Notifications'}
        </Text>
        <ErrorBanner
          visible={!!notificationsErrorMessage}
          message={notificationsErrorMessage}
          onDismiss={() => {
            clearPushNotificationsError();
            clearLastPermissionError(null);
          }}
          onRetry={notificationsErrorRetry}
        />
        <GlassCard dark={dark} radius={20} style={styles.card}>
          <SettingToggleRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="bell-outline"
            label={t('PushNotifications') ?? 'Push Notifications'}
            value={t('ReceiveRealTimePushNotificationsYourDevices') ?? 'Receive real-time push notifications on your devices'}
            toggled={notificationsEnabled}
            loading={isTogglingNotifications}
            disabled={isTogglingNotifications}
            onToggle={handleToggleNotifications}
            testID="row-PushNotifications"
            isLast
          />
        </GlassCard>
        {showPermissionGuidance && (
          <View testID="notifications-permission-guidance" style={styles.guidance}>
            <Text style={[styles.guidanceText, { color: colors.error }]}>
              {t('NotificationsPermissionBlockedGuidance')}
            </Text>
            <TouchableOpacity
              onPress={openNotificationSettings}
              testID="notifications-open-settings"
              activeOpacity={0.7}
            >
              <Text style={[styles.guidanceAction, { color: colors.primary }]}>
                {t('NotificationsPermissionOpenSettings')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Security */}
        <Text style={[styles.sectionTitle, { color: ink2 }]}>
          {t('MenuPasswordAuthentication') ?? 'Security'}
        </Text>
        {/* A refused enable is a statement about the device, not something to retry, so
            the banner only offers dismiss. */}
        <ErrorBanner
          visible={!!biometricErrorMessage}
          message={biometricErrorMessage}
          onDismiss={() => setBiometricError(null)}
        />
        <GlassCard dark={dark} radius={20} style={styles.card}>
          <SettingRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="lock-reset"
            label={t('ChangePassword') ?? 'Change Password'}
            value=""
            onPress={() => navigation.navigate('ChangePassword')}
            testID="row-ChangePassword"
          />
          <SettingRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="cellphone-key"
            label={t('AuthenticatorAppTitle') ?? 'Authenticator App'}
            value={user?.twoFactorEnabled ? t('LabelEnabled') ?? 'On' : t('LabelDisabled') ?? 'Off'}
            valueColor={user?.twoFactorEnabled ? '#0e9f6e' : undefined}
            onPress={() => navigation.navigate('TwoFactorSetup')}
            testID="row-AuthenticatorApp"
          />
          <SettingToggleRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="fingerprint"
            label={t('BiometricAuthLabel') ?? 'Biometric Authentication'}
            value={t('BiometricAuthDescription') ?? 'Use fingerprint or face to unlock the app'}
            toggled={biometricEnabled}
            loading={isTogglingBiometrics}
            // Until the stored value is known a tap would land on defaults and be
            // replayed over, so the row refuses to move before then (#1052).
            disabled={!canToggleBiometrics}
            onToggle={handleToggleBiometrics}
            testID="row-BiometricAuth"
          />
          <SettingRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="lock-outline"
            label={t('PinChangeLabel') ?? 'App PIN'}
            value={hasPin ? (t('LabelEnabled') ?? 'On') : (t('LabelDisabled') ?? 'Off')}
            valueColor={hasPin ? '#0e9f6e' : undefined}
            onPress={() => rootNavigation.navigate('PinSetup')}
            testID="row-ChangePin"
          />
          <SettingRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="shield-check-outline"
            iconColor={colors.primary}
            label={t('SecurityAndSupport') ?? 'Security & Support'}
            value={t('SecurityAndSupportDescription') ?? 'Support period, safe usage and vulnerability reporting'}
            onPress={handleOpenSecurityPage}
            testID="row-SecurityAndSupport"
            isLast
          />
        </GlassCard>

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleSignOut}
          activeOpacity={0.82}
          style={styles.signOutBtn}
        >
          <MaterialCommunityIcons name="logout" size={18} color="#e74c3c" />
          <Text style={styles.signOutText}>{t('ButtonSignOut') ?? 'Sign out'}</Text>
        </TouchableOpacity>

        {/* Version badge */}
        <Text style={[styles.version, { color: ink2 }]}>EconoFlow · v1.0.0</Text>
      </ScrollView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  fill:   { flex: 1 },
  scroll: { paddingHorizontal: 20 },

  heroSection: { alignItems: 'center', paddingBottom: 28 },
  avatarWrap: {
    marginBottom: 14,
    shadowColor: '#0f76a8', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35, shadowRadius: 18, elevation: 8,
  },
  avatar: {
    width: 80, height: 80, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText:  { color: '#fff', fontWeight: '900', fontSize: 34 },
  displayName: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  email:       { fontSize: 13.5, fontWeight: '500', opacity: 0.8 },

  projectPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    marginTop: 10, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 999, backgroundColor: '#0f76a826',
  },
  projectPillText: { fontSize: 12.5, fontWeight: '700', color: '#0f76a8' },

  sectionTitle: { fontSize: 11.5, fontWeight: '700', letterSpacing: 0.8, marginBottom: 8, marginTop: 20, paddingLeft: 4 },

  card: { marginBottom: 4 },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  settingInfo:  { flex: 1, gap: 2 },
  settingLabel: { fontSize: 11.5, fontWeight: '600' },
  settingValue: { fontSize: 14, fontWeight: '700' },

  guidance: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },
  guidanceText: { fontSize: 12.5, fontWeight: '600', lineHeight: 18 },
  guidanceAction: { fontSize: 13, fontWeight: '800' },

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 28, paddingVertical: 14, borderRadius: 16,
    backgroundColor: 'rgba(231,76,60,0.10)', borderWidth: 1, borderColor: 'rgba(231,76,60,0.28)',
  },
  signOutText: { color: '#e74c3c', fontWeight: '800', fontSize: 15 },

  version: { textAlign: 'center', fontSize: 11.5, marginTop: 20, opacity: 0.5 },
});
