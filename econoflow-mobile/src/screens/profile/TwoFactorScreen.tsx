import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import { useAuthStore } from '../../store/authStore';
import {
  useTwoFactorSetup,
  useEnableTwoFactor,
  useDisableTwoFactor,
} from '../../hooks/useProfile';
import { GlassScreen } from '../../components/common/GlassScreen';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { captureError } from '../../monitoring/sentry';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';

type Props = NativeStackScreenProps<ProfileStackParamList, 'TwoFactorSetup'>;

export const TwoFactorScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2, hair } = useAuroraSkin();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();

  const { data: setupData, isLoading } = useTwoFactorSetup();
  const enableMutation = useEnableTwoFactor();
  const disableMutation = useDisableTwoFactor();

  const twoFactorEnabled = setupData?.isTwoFactorEnabled ?? user?.twoFactorEnabled ?? false;

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codeError, setCodeError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [apiError, setApiError] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const handleEnable = async () => {
    let valid = true;

    if (!code.trim()) {
      setCodeError(t('RequiredField') ?? 'This field is required.');
      valid = false;
    } else {
      setCodeError('');
    }

    if (!valid) return;
    setApiError('');

    try {
      const result = await enableMutation.mutateAsync({ code: code.trim() });
      setRecoveryCodes(result.recoveryCodes ?? []);
      setCode('');
    } catch (err) {
      captureError(err, { screen: 'ProfileTwoFactorScreen', action: 'enableTwoFactor' });
      setApiError(t('ErrorGeneric') ?? 'Something went wrong. Please try again.');
    }
  };

  const handleDisable = async () => {
    let valid = true;

    if (!password) {
      setPasswordError(t('RequiredField') ?? 'This field is required.');
      valid = false;
    } else {
      setPasswordError('');
    }

    if (!code.trim()) {
      setCodeError(t('RequiredField') ?? 'This field is required.');
      valid = false;
    } else {
      setCodeError('');
    }

    if (!valid) return;
    setApiError('');

    try {
      await disableMutation.mutateAsync({ password, twoFactorCode: code.trim() });
      navigation.goBack();
    } catch (err) {
      captureError(err, { screen: 'ProfileTwoFactorScreen', action: 'disableTwoFactor' });
      setApiError(t('ErrorGeneric') ?? 'Something went wrong. Please try again.');
    } finally {
      setPassword('');
      setCode('');
    }
  };

  if (isLoading) {
    return (
      <GlassScreen dark={dark}>
        <View style={styles.center}>
          <Text style={{ color: ink2 }}>{t('LoadingTwoFactorSetup') ?? 'Preparing authenticator setup...'}</Text>
        </View>
      </GlassScreen>
    );
  }

  return (
    <GlassScreen dark={dark}>
      <ErrorBanner
        visible={!!apiError}
        message={apiError}
        onDismiss={() => setApiError('')}
      />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {twoFactorEnabled ? (
          // ── Disable flow ──────────────────────────────────────────────────
          <>
            <Text style={[styles.title, { color: ink }]}>{t('DisableTwoFactorTitle') ?? 'Disable two-factor authentication'}</Text>

            <AuroraField
              dark={dark}
              icon="lock-outline"
              placeholder={t('PlaceholderCurrentPassword') ?? 'Current password'}
              testID="PlaceholderCurrentPassword"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              hasError={!!passwordError}
            />
            {!!passwordError && (
              <Text style={styles.errorText}>{passwordError}</Text>
            )}

            <AuroraField
              dark={dark}
              icon="cellphone-key"
              placeholder={t('PlaceholderAuthenticatorCode') ?? '6-digit code'}
              testID="PlaceholderAuthenticatorCode"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              hasError={!!codeError}
            />
            {!!codeError && (
              <Text style={styles.errorText}>{codeError}</Text>
            )}

            <AuroraPrimaryButton
              label={t('ButtonDisableTwoFactor') ?? 'Disable two-factor authentication'}
              onPress={handleDisable}
              loading={disableMutation.isPending}
              testID="ButtonDisableTwoFactor"
            />
          </>
        ) : recoveryCodes.length > 0 ? (
          // ── Recovery codes display ────────────────────────────────────────
          <>
            <Text style={[styles.title, { color: ink }]}>{t('RecoveryCodesTitle') ?? 'Recovery codes'}</Text>
            <Text style={[styles.description, { color: ink2 }]}>
              {t('RecoveryCodesDescription') ?? 'Save these one-time recovery codes in a safe place. Each code can be used once.'}
            </Text>
            <View style={styles.codesBox}>
              {recoveryCodes.map((rc) => (
                <Text key={rc} style={[styles.recoveryCode, { color: ink, borderColor: hair }]}>{rc}</Text>
              ))}
            </View>
            <AuroraPrimaryButton
              label={t('ButtonICopiedCodes') ?? 'I saved these codes'}
              onPress={() => navigation.goBack()}
              testID="ButtonICopiedCodes"
            />
          </>
        ) : (
          // ── Setup (enable) flow ───────────────────────────────────────────
          <>
            <Text style={[styles.title, { color: ink }]}>{t('TwoFactorSetupInstructionsTitle') ?? 'Set up your authenticator app'}</Text>
            <Text style={[styles.description, { color: ink2 }]}>
              {t('TwoFactorSetupInstructionsDescription') ?? 'Scan this QR code in your authenticator app, then confirm with the first 6-digit code.'}
            </Text>

            {setupData?.otpAuthUri && (
              <View style={styles.qrCodeWrap}>
                <QRCode
                  value={setupData.otpAuthUri}
                  size={200}
                  backgroundColor="white"
                  testID="TwoFactorQRCode"
                />
              </View>
            )}

            <View style={[styles.keyBox, { borderColor: hair }]}>
              <Text style={[styles.keyLabel, { color: ink2 }]}>{t('ManualSetupKeyLabel') ?? 'Manual setup key'}</Text>
              <View style={styles.keyRow}>
                <Text style={[styles.keyValue, { color: ink }]} selectable>
                  {setupData?.sharedKey ?? ''}
                </Text>
                <TouchableOpacity
                  onPress={() => Clipboard.setStringAsync(setupData?.sharedKey ?? '')}
                  testID="ButtonCopySharedKey"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="content-copy" size={18} color="#0f76a8" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: hair }]} />

            <AuroraField
              dark={dark}
              icon="cellphone-key"
              placeholder={t('PlaceholderAuthenticatorCode') ?? '6-digit code'}
              testID="PlaceholderAuthenticatorCode"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              maxLength={6}
              hasError={!!codeError}
            />
            {!!codeError && (
              <Text style={styles.errorText}>{codeError}</Text>
            )}

            <AuroraPrimaryButton
              label={t('ButtonEnableTwoFactor') ?? 'Enable two-factor authentication'}
              onPress={handleEnable}
              loading={enableMutation.isPending}
              testID="ButtonEnableTwoFactor"
            />

            <View style={styles.iconHint}>
              <MaterialCommunityIcons name="information-outline" size={14} color={ink2} />
              <Text style={[styles.iconHintText, { color: ink2 }]}>
                {t('AuthenticatorAppDescription') ?? 'Use Google Authenticator, Authy, or Microsoft Authenticator for two-factor security.'}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  fill:          { flex: 1 },
  scroll:        { paddingHorizontal: 24 },
  center:        { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title:         { fontSize: 22, fontWeight: '800', marginBottom: 8 },
  description:   { fontSize: 13.5, fontWeight: '500', marginBottom: 20, lineHeight: 20 },
  qrCodeWrap:    { alignItems: 'center', marginBottom: 20 },
  keyBox:        { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 20 },
  keyLabel:      { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 6 },
  keyRow:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  keyValue:      { fontSize: 15, fontWeight: '700', letterSpacing: 1, fontVariant: ['tabular-nums'], flex: 1 },
  separator:     { height: StyleSheet.hairlineWidth, marginBottom: 8 },
  errorText:     { color: '#e74c3c', fontSize: 12, marginTop: 4, marginLeft: 4 },
  codesBox:      { marginVertical: 16, gap: 8 },
  recoveryCode:  { fontFamily: 'monospace', fontSize: 14, fontWeight: '700', padding: 10, borderRadius: 10, borderWidth: 1, letterSpacing: 1 },
  iconHint:      { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 16 },
  iconHintText:  { fontSize: 12, flex: 1, lineHeight: 18 },
});
