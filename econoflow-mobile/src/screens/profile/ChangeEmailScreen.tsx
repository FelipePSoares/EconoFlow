import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import { useAuthStore } from '../../store/authStore';
import { useChangeEmail } from '../../hooks/useProfile';
import { GlassScreen } from '../../components/common/GlassScreen';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { captureError } from '../../monitoring/sentry';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ChangeEmail'>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ChangeEmailScreen: React.FC<Props> = ({ navigation: _navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { mutateAsync, isPending } = useChangeEmail();

  const [email, setEmail] = useState(user?.email ?? '');
  const [emailError, setEmailError] = useState('');
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState(false);

  const validate = () => {
    if (!email.trim()) {
      setEmailError(t('RequiredField') ?? 'This field is required.');
      return false;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setEmailError(t('InvalidEmailFormat') ?? 'Invalid email format.');
      return false;
    }
    setEmailError('');
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setApiError('');
    try {
      await mutateAsync({ newEmail: email.trim() });
      setSuccess(true);
    } catch (err) {
      captureError(err, { screen: 'ChangeEmailScreen', action: 'changeEmail' });
      setApiError(t('ErrorChangeEmailFailed') ?? 'Failed to change email. Please try again.');
    }
  };

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
        <Text style={[styles.title, { color: ink }]}>{t('ChangeEmailAddress') ?? 'Change Email Address'}</Text>

        {success ? (
          <View style={styles.successBox}>
            <Text style={[styles.successText, { color: ink2 }]}>
              {t('VerificationEmailSent') ?? 'A verification email has been sent. Please check your inbox.'}
            </Text>
          </View>
        ) : (
          <>
            <AuroraField
              dark={dark}
              icon="email-outline"
              placeholder={t('PlaceholderEmailAddress') ?? 'Email address'}
              testID="PlaceholderEmailAddress"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              hasError={!!emailError}
            />
            {!!emailError && (
              <Text style={styles.errorText}>{emailError}</Text>
            )}

            <AuroraPrimaryButton
              label={t('ButtonSave') ?? 'Save'}
              onPress={handleSave}
              loading={isPending}
              testID="ButtonSave"
            />
          </>
        )}
      </ScrollView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  fill:        { flex: 1 },
  scroll:      { paddingHorizontal: 24 },
  title:       { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  errorText:   { color: '#e74c3c', fontSize: 12, marginTop: 4, marginLeft: 4 },
  successBox:  { marginTop: 24, padding: 16, borderRadius: 16, backgroundColor: 'rgba(14,159,110,0.12)', borderWidth: 1, borderColor: 'rgba(14,159,110,0.28)' },
  successText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
