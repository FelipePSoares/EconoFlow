import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { HelperText } from 'react-native-paper';
import { useForm, Controller, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OnboardingParamList } from '../../navigation/OnboardingNavigator';
import { useUpdateProfile } from '../../hooks/useUpdateProfile';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { captureError } from '../../monitoring/sentry';
import { useAuthStore } from '../../store/authStore';
import i18n from '../../i18n';
import { AuthHero } from '../../components/auth/AuthHero';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassScreen } from '../../components/common/GlassScreen';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

export type Props = {
  navigation: NativeStackNavigationProp<OnboardingParamList, 'ProfileSetup'>;
};

interface FormValues {
  firstName: string;
  lastName: string;
  languageCode: string;
}

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
];

export const ProfileSetupScreen: React.FC<Props> = () => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const insets = useSafeAreaInsets();
  const [error, setError] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);

  const updateProfile = useUpdateProfile();
  const setOpenCreateProjectOnStart = useAuthStore((s) => s.setOpenCreateProjectOnStart);
  const { registerPushNotifications } = usePushNotifications();

  const {
    control,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      firstName: '',
      lastName: '',
      languageCode: i18n.language?.startsWith('pt') ? 'pt' : 'en',
    },
  });

  const selectedLang = useWatch({ control, name: 'languageCode' });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setOpenCreateProjectOnStart(true);
    try {
      await updateProfile.mutateAsync([
        { op: 'replace', path: '/firstName', value: values.firstName },
        { op: 'replace', path: '/lastName', value: values.lastName },
        { op: 'replace', path: '/languageCode', value: values.languageCode },
      ]);
      if (values.languageCode) {
        i18n.changeLanguage(values.languageCode.startsWith('pt') ? 'pt' : 'en');
      }

      registerPushNotifications().catch(() => {});
    } catch (err) {
      captureError(err, { screen: 'ProfileSetupScreen', action: 'setupProfile' });
      setOpenCreateProjectOnStart(false);
      setError(t('ErrorProfileUpdateFailed'));
    }
  };

  return (
    <GlassScreen dark={dark}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <AuthHero dark={dark} subtitle={t('ProfileSetupSubtitle')} />

          <GlassCard dark={dark} radius={28} style={styles.card}>
            <Text style={[styles.cardTitle, { color: ink }]}>{t('ProfileSetupTitle')}</Text>

            <Controller
              control={control}
              name="firstName"
              rules={{
                required: t('RequiredField'),
                maxLength: { value: 100, message: t('PropertyMaxLength', { field: t('FieldFirstName'), max: 100 }) },
              }}
              render={({ field: { onChange, value } }) => (
                <AuroraField
                  dark={dark}
                  testID={t('PlaceholderFirstName')}
                  icon="account-outline"
                  placeholder={t('PlaceholderFirstName')}
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="words"
                  hasError={!!errors.firstName}
                />
              )}
            />
            {errors.firstName && <HelperText type="error">{errors.firstName.message}</HelperText>}

            <Controller
              control={control}
              name="lastName"
              rules={{
                required: t('RequiredField'),
                maxLength: { value: 100, message: t('PropertyMaxLength', { field: t('FieldLastName'), max: 100 }) },
              }}
              render={({ field: { onChange, value } }) => (
                <AuroraField
                  dark={dark}
                  testID={t('PlaceholderLastName')}
                  icon="account-outline"
                  placeholder={t('PlaceholderLastName')}
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="words"
                  hasError={!!errors.lastName}
                />
              )}
            />
            {errors.lastName && <HelperText type="error">{errors.lastName.message}</HelperText>}

            {/* Language picker */}
            <Text style={[styles.sectionLabel, { color: ink2 }]}>{t('FieldLanguage')}</Text>
            <Controller
              control={control}
              name="languageCode"
              rules={{ required: t('RequiredField') }}
              render={() => (
                <View>
                  <TouchableOpacity
                    style={[styles.langSelector, { borderColor: ink2 }]}
                    onPress={() => setLangOpen((v) => !v)}
                  >
                    <Text style={[styles.langValue, { color: ink }]}>
                      {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLang)?.label ?? t('PlaceholderLanguage')}
                    </Text>
                  </TouchableOpacity>
                  {langOpen && (
                    <View style={[styles.langDropdown, { borderColor: ink2 }]}>
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <TouchableOpacity
                          key={lang.code}
                          style={styles.langOption}
                          onPress={() => {
                            setValue('languageCode', lang.code);
                            setLangOpen(false);
                          }}
                        >
                          <Text style={[styles.langOptionText, { color: ink }]}>{lang.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            />
            {errors.languageCode && <HelperText type="error">{errors.languageCode.message}</HelperText>}

            <ErrorBanner
              visible={!!error}
              message={error ?? undefined}
              onDismiss={() => setError(null)}
            />

            <AuroraPrimaryButton
              testID={t('ButtonSaveAndContinue')}
              label={t('ButtonSaveAndContinue')}
              onPress={handleSubmit(onSubmit)}
              loading={updateProfile.isPending}
              icon="arrow-right"
            />
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  card: { padding: 22, marginBottom: 16 },
  cardTitle: { fontSize: 19, fontWeight: '800', marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  langSelector: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  langValue: { fontSize: 14 },
  langDropdown: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 4,
    overflow: 'hidden',
  },
  langOption: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  langOptionText: { fontSize: 14 },
});
