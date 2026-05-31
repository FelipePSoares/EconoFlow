import React, { useState } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  useColorScheme,
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

type Props = NativeStackScreenProps<AuthStackParamList, 'TwoFactor'>;

interface FormValues {
  code: string;
}

export const TwoFactorScreen: React.FC<Props> = ({ route }) => {
  const { t } = useTranslation();
  const dark = useColorScheme() === 'dark';
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

  const ink2 = dark ? '#8aa0b6' : '#5b6b7c';
  const bg   = dark ? '#061e33' : '#e6eff6';
  const cardBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
  const cardBorder = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.85)';

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthHero dark={dark} subtitle={t('TwoFactorSignInTitle')} />

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
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
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex:  { flex: 1 },
  scroll:{ flexGrow: 1, paddingBottom: 40 },
  card: {
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 12,
  },
  description: { textAlign: 'center', fontSize: 13.5, lineHeight: 20, marginBottom: 4 },
});
