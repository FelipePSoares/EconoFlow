import React from 'react';
import {
  ScrollView, StyleSheet, TouchableOpacity, View,
} from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../navigation/MainNavigator';
import { useAuthStore } from '../../store/authStore';
import { useProjectStore } from '../../store/projectStore';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

type Props = {
  navigation: BottomTabNavigationProp<MainTabParamList, 'Profile'>;
};

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
}

const SettingRow: React.FC<SettingRowProps> = ({
  icon, label, value, valueColor, dark, ink, ink2, hair, isLast,
}) => (
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

export const ProfileScreen: React.FC<Props> = () => {
  const { t } = useTranslation();
  const { dark, ink, ink2, hair } = useAuroraSkin();
  const insets = useSafeAreaInsets();
  const { user, clearAuth } = useAuthStore();
  const { clearProject, selectedProject } = useProjectStore();

  const handleSignOut = () => {
    clearAuth();
    clearProject();
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
          <View style={styles.avatarWrap}>
            <LinearGradient
              colors={['#0f76a8', '#14c08a']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatar}
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </LinearGradient>
          </View>
          <Text style={[styles.displayName, { color: ink }]}>{displayName}</Text>
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
            icon="shield-check-outline"
            label={t('LabelTwoFactorAuthentication') ?? '2FA'}
            value={user?.twoFactorEnabled ? (t('LabelEnabled') ?? 'Enabled') : (t('LabelDisabled') ?? 'Disabled')}
            valueColor={user?.twoFactorEnabled ? '#0e9f6e' : undefined}
          />
          <SettingRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="translate"
            label={t('LabelLanguage') ?? 'Language'}
            value={user?.languageCode ?? 'en-US'}
          />
          <SettingRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="email-check-outline"
            label={t('EmailVerification') ?? 'Email'}
            value={user?.emailConfirmed ? (t('EmailVerified') ?? 'Verified') : (t('EmailNotVerified') ?? 'Not verified')}
            valueColor={user?.emailConfirmed ? '#0e9f6e' : '#e74c3c'}
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
          />
          <SettingRow
            dark={dark} ink={ink} ink2={ink2} hair={hair}
            icon="cellphone-key"
            label={t('AuthenticatorAppTitle') ?? 'Authenticator App'}
            value={user?.twoFactorEnabled ? t('LabelEnabled') ?? 'On' : t('LabelDisabled') ?? 'Off'}
            valueColor={user?.twoFactorEnabled ? '#0e9f6e' : undefined}
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
