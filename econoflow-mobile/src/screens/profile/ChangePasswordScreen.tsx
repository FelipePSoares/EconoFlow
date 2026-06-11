import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import { useChangePassword } from '../../hooks/useProfile';
import { GlassScreen } from '../../components/common/GlassScreen';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { captureError } from '../../monitoring/sentry';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ChangePassword'>;

export const ChangePasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink } = useAuroraSkin();
  const insets = useSafeAreaInsets();
  const { mutateAsync, isPending } = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPasswordError, setCurrentPasswordError] = useState('');
  const [newPasswordError, setNewPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [apiError, setApiError] = useState('');

  const validate = () => {
    let valid = true;

    if (!currentPassword) {
      setCurrentPasswordError(t('RequiredField') ?? 'This field is required.');
      valid = false;
    } else {
      setCurrentPasswordError('');
    }

    if (!newPassword) {
      setNewPasswordError(t('RequiredField') ?? 'This field is required.');
      valid = false;
    } else if (newPassword === currentPassword) {
      setNewPasswordError(t('ErrorNewPasswordSameAsCurrent') ?? 'New password must differ from current password.');
      valid = false;
    } else {
      setNewPasswordError('');
    }

    if (!confirmPassword) {
      setConfirmPasswordError(t('RequiredField') ?? 'This field is required.');
      valid = false;
    } else if (confirmPassword !== newPassword) {
      setConfirmPasswordError(t('PasswordsMustMatch') ?? 'Passwords must match');
      valid = false;
    } else {
      setConfirmPasswordError('');
    }

    return valid;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setApiError('');
    try {
      await mutateAsync({ oldPassword: currentPassword, newPassword });
      navigation.goBack();
    } catch (err) {
      captureError(err, { screen: 'ChangePasswordScreen', action: 'changePassword' });
      setApiError(t('ErrorChangePasswordFailed') ?? 'Failed to change password. Please try again.');
    } finally {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
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
        <Text style={[styles.title, { color: ink }]}>{t('ChangePassword') ?? 'Change Password'}</Text>

        <AuroraField
          dark={dark}
          icon="lock-outline"
          placeholder={t('PlaceholderCurrentPassword') ?? 'Current password'}
          testID="PlaceholderCurrentPassword"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          hasError={!!currentPasswordError}
        />
        {!!currentPasswordError && (
          <Text style={styles.errorText}>{currentPasswordError}</Text>
        )}

        <AuroraField
          dark={dark}
          icon="lock-reset"
          placeholder={t('PlaceholderNewPassword') ?? 'New Password'}
          testID="PlaceholderNewPassword"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          hasError={!!newPasswordError}
        />
        {!!newPasswordError && (
          <Text style={styles.errorText}>{newPasswordError}</Text>
        )}

        <AuroraField
          dark={dark}
          icon="lock-check-outline"
          placeholder={t('PlaceholderConfirmNewPassword') ?? 'Confirm New Password'}
          testID="PlaceholderConfirmNewPassword"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          hasError={!!confirmPasswordError}
        />
        {!!confirmPasswordError && (
          <Text style={styles.errorText}>{confirmPasswordError}</Text>
        )}

        <AuroraPrimaryButton
          label={t('ButtonSave') ?? 'Save'}
          onPress={handleSave}
          loading={isPending}
          testID="ButtonSave"
        />
      </ScrollView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  fill:      { flex: 1 },
  scroll:    { paddingHorizontal: 24 },
  title:     { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  errorText: { color: '#e74c3c', fontSize: 12, marginTop: 4, marginLeft: 4 },
});
