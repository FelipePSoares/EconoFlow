import React, { useState } from 'react';
import {
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Text, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { mobileLogin, getCurrentUser } from '../../api/auth.api';
import { useAuthStore } from '../../store/authStore';
import i18n from '../../i18n';
import { AuthHero } from '../../components/auth/AuthHero';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassScreen } from '../../components/common/GlassScreen';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

type Props = NativeStackScreenProps<AuthStackParamList, 'TwoFactor'>;

interface FormValues { code: string; }

export const TwoFactorScreen: React.FC<Props> = ({ route }) => {
  const { t } = useTranslation();
  const { dark, ink2 } = useAuroraSkin();
  const { setTokens, setUser } = useAuthStore();
  const [authError, setAuthError] = useState<string | null>(null);
  const { email, password } = route.params;

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { code: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      mobileLogin({ email, password, twoFactorCode: values.code }),
    onSuccess: async (response) => {
      const { accessToken, refreshToken } = response.data;
      setTokens(accessToken, refreshToken);
      try {
        const userResponse = await getCurrentUser();
        setUser(userResponse.data);
        if (userResponse.data.languageCode) {
          const lang = userResponse.data.languageCode.startsWith('pt') ? 'pt' : 'en';
          i18n.changeLanguage(lang);
        }
      } catch { /* proceed */ }
    },
    onError: () => setAuthError(t('ErrorInvalidTwoFactorCode')),
  });

  return (
    <GlassScreen dark={dark}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthHero dark={dark} subtitle={t('TwoFactorSignInTitle')} />

          <GlassCard dark={dark} radius={28} style={styles.card}>
            <Text style={[styles.description, { color: ink2 }]}>
              {t('LabelEnterTwoFactorCode')}
            </Text>

            <Controller
              control={control}
              name="code"
              rules={{ required: t('RequiredField') }}
              render={({ field: { onChange, value } }) => (
                <AuroraField
                  dark={dark}
                  icon="shield-key-outline"
                  placeholder={t('FieldTwoFactorCode')}
                  value={value}
                  onChangeText={onChange}
                  keyboardType="number-pad"
                  hasError={!!errors.code}
                />
              )}
            />
            {errors.code && <HelperText type="error">{errors.code.message}</HelperText>}
            {authError  && <HelperText type="error">{authError}</HelperText>}

            <AuroraPrimaryButton
              label={t('ButtonVerify')}
              onPress={handleSubmit(v => { setAuthError(null); mutation.mutate(v); })}
              loading={mutation.isPending}
              icon="arrow-right"
            />
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  flex:  { flex: 1 },
  scroll:{ flexGrow: 1, justifyContent: 'center', paddingVertical: 40 },
  card: {
    marginHorizontal: 20,
    padding: 22,
  },
  description: { textAlign: 'center', fontSize: 13.5, lineHeight: 20, marginBottom: 4 },
});
