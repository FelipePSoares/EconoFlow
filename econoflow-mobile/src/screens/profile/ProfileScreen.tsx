import React from 'react';
import {
  ScrollView, StyleSheet, Switch, TouchableOpacity, View,
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
import type { RootParamList } from '../../navigation/AppNavigator';
import { useAuthStore } from '../../store/authStore';
import { useBiometricStore } from '../../store/biometricStore';
import { usePinStore } from '../../store/pinStore';
import { useLockStore } from '../../store/lockStore';
import { useProjectStore } from '../../store/projectStore';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

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
  isLast?: boolean;
  onPress?: () => void;
  testID?: string;
}

const SettingRow: React.FC<SettingRowProps> = ({
  icon, label, value, valueColor, dark, ink, ink2, hair, isLast, onPress, testID,
}) => {
  const inner = (
    <View style={[styles.settingRow, { borderBottomColor: isLast ? 'transparent' : hair }]}>
      <View style={[styles.settingIconWrap, { backgroundColor: '#0f76a8' + (dark ? '28' : '18') }]}>
        <MaterialCommunityIcons name={icon as never} size={18} color="#0f76a8" />
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
  isLast?: boolean;
  onPress?: () => void;
  testID?: string;
}

const SettingToggleRow: React.FC<SettingToggleRowProps> = ({
  icon, label, value, toggled, dark, ink, ink2, hair, disabled, isLast, onPress, testID,
}) => {
  const inner = (
    <View style={[styles.settingRow, { borderBottomColor: isLast ? 'transparent' : hair }]}>
      <View style={[styles.settingIconWrap, { backgroundColor: '#0f76a8' + (dark ? '28' : '18') }]}>
        <MaterialCommunityIcons name={icon as never} size={18} color="#0f76a8" />
      </View>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, { color: ink2 }]}>{label}</Text>
        <Text style={[styles.settingValue, { color: ink }]}>{value}</Text>
      </View>
      <Switch
        value={toggled}
        disabled={disabled}
        onValueChange={onPress}
        trackColor={{ false: hair, true: '#0f76a880' }}
        thumbColor={toggled ? '#0f76a8' : '#ccc'}
      />
    </View>
  );

  return <View testID={testID}>{inner}</View>;
};

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2, hair } = useAuroraSkin();
  const insets = useSafeAreaInsets();
  const { user, clearAuth } = useAuthStore();
  const { clearProject, selectedProject } = useProjectStore();
  const { biometricEnabled, setBiometricEnabled, resetBiometricPromptSkipped } = useBiometricStore();
  const { hasPin, clearPin } = usePinStore();
  const { reset: resetLock } = useLockStore();
  const rootNavigation = useNavigation<NativeStackNavigationProp<RootParamList>>();
  const queryClient = useQueryClient();
  const {
    notificationsEnabled,
    isRegistering,
    registerPushNotifications,
    unregisterPushNotifications,
  } = usePushNotifications();

  const handleSignOut = async () => {
    await unregisterPushNotifications();
    queryClient.clear();
    clearPin();
    resetLock();
    clearAuth();
    clearProject();
  };

  const handleToggleNotifications = () => {
    if (notificationsEnabled) {
      unregisterPushNotifications();
    } else {
      registerPushNotifications();
    }
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
        <GlassCard dark={dark} radius={20} style={styles.card}>
          <SettingToggleRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="bell-outline"
            label={t('PushNotifications') ?? 'Push Notifications'}
            value={t('ReceiveRealTimePushNotificationsYourDevices') ?? 'Receive real-time push notifications on your devices'}
            toggled={notificationsEnabled}
            disabled={isRegistering}
            onPress={handleToggleNotifications}
            testID="row-PushNotifications"
            isLast
          />
        </GlassCard>

        {/* Security */}
        <Text style={[styles.sectionTitle, { color: ink2 }]}>
          {t('MenuPasswordAuthentication') ?? 'Security'}
        </Text>
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
            onPress={() => {
              const newValue = !biometricEnabled;
              setBiometricEnabled(newValue);
              if (newValue) resetBiometricPromptSkipped();
            }}
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

  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 28, paddingVertical: 14, borderRadius: 16,
    backgroundColor: 'rgba(231,76,60,0.10)', borderWidth: 1, borderColor: 'rgba(231,76,60,0.28)',
  },
  signOutText: { color: '#e74c3c', fontWeight: '800', fontSize: 15 },

  version: { textAlign: 'center', fontSize: 11.5, marginTop: 20, opacity: 0.5 },
});
