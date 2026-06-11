import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import { useAuthStore } from '../../store/authStore';
import { useUpdateProfile } from '../../hooks/useUpdateProfile';
import { GlassScreen } from '../../components/common/GlassScreen';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

type Props = NativeStackScreenProps<ProfileStackParamList, 'EditName'>;

export const EditNameScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { mutateAsync, isPending } = useUpdateProfile();

  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');
  const [apiError, setApiError] = useState('');

  const validate = () => {
    let valid = true;
    if (!firstName.trim()) {
      setFirstNameError(t('RequiredField') ?? 'This field is required.');
      valid = false;
    } else {
      setFirstNameError('');
    }
    if (!lastName.trim()) {
      setLastNameError(t('RequiredField') ?? 'This field is required.');
      valid = false;
    } else {
      setLastNameError('');
    }
    return valid;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setApiError('');
    try {
      await mutateAsync([
        { op: 'replace', path: '/firstName', value: firstName.trim() },
        { op: 'replace', path: '/lastName', value: lastName.trim() },
      ]);
      navigation.goBack();
    } catch {
      setApiError(t('ErrorProfileUpdateFailed') ?? 'Failed to update your profile. Please try again.');
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
        <Text style={[styles.title, { color: ink }]}>{t('EditName') ?? 'Edit Name'}</Text>

        <AuroraField
          dark={dark}
          icon="account-outline"
          placeholder={t('PlaceholderFirstName') ?? 'First name'}
          testID="PlaceholderFirstName"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          hasError={!!firstNameError}
        />
        {!!firstNameError && (
          <Text style={styles.errorText}>{firstNameError}</Text>
        )}

        <AuroraField
          dark={dark}
          icon="account-outline"
          placeholder={t('PlaceholderLastName') ?? 'Last name'}
          testID="PlaceholderLastName"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          hasError={!!lastNameError}
        />
        {!!lastNameError && (
          <Text style={styles.errorText}>{lastNameError}</Text>
        )}

        <View style={styles.buttonRow}>
          <AuroraPrimaryButton
            label={t('ButtonSave') ?? 'Save'}
            onPress={handleSave}
            loading={isPending}
            testID="ButtonSave"
          />
        </View>

        <View style={[styles.ink2Hint, { marginTop: 12 }]}>
          <Text style={{ color: ink2, fontSize: 12 }}>
            {t('FieldFirstName') ?? 'First Name'} &amp; {t('FieldLastName') ?? 'Last Name'}
          </Text>
        </View>
      </ScrollView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  fill:       { flex: 1 },
  scroll:     { paddingHorizontal: 24 },
  title:      { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  errorText:  { color: '#e74c3c', fontSize: 12, marginTop: 4, marginLeft: 4 },
  buttonRow:  { marginTop: 8 },
  ink2Hint:   {},
});
