import React, { useState } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Linking,
} from 'react-native';
import { Text, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { register, mobileLogin, getCurrentUser } from '../../api/auth.api';
import { useAuthStore } from '../../store/authStore';
import i18n from '../../i18n';
import { AuthHero } from '../../components/auth/AuthHero';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassScreen } from '../../components/common/GlassScreen';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { captureError } from '../../monitoring/sentry';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Register'>;
};

interface FormValues {
  email: string;
  password: string;
  confirmPassword: string;
}

const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

export const RegisterScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { setTokens, setUser } = useAuthStore();
  const [serverError, setServerError] = useState<string | null>(null);
  const [autoLoginFailed, setAutoLoginFailed] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });
  // eslint-disable-next-line react-hooks/incompatible-library
  const passwordValue = watch('password');

  const registerMutation = useMutation({
    mutationFn: (values: FormValues) => register(values.email, values.password),
    onSuccess: async (_data, variables) => {
      try {
        const loginResponse = await mobileLogin({ email: variables.email, password: variables.password });
        const { accessToken, refreshToken } = loginResponse.data;

        if (typeof accessToken !== 'string' || !accessToken) {
          const body = loginResponse.data as unknown as { requiresTwoFactor?: boolean };
          if (body?.requiresTwoFactor) {
            navigation.navigate('TwoFactor', { email: variables.email, password: variables.password });
            return;
          }
          setAutoLoginFailed(true);
          return;
        }

        setTokens(accessToken, refreshToken);
        try {
          const userResponse = await getCurrentUser();
          setUser(userResponse.data);
          if (userResponse.data.languageCode) {
            const lang = userResponse.data.languageCode.startsWith('pt') ? 'pt' : 'en';
            i18n.changeLanguage(lang);
          }
        } catch { /* proceed without user profile */ }
      } catch (err: unknown) {
        const e = err as { response?: { data?: { requiresTwoFactor?: boolean } } };
        if (e?.response?.data?.requiresTwoFactor) {
          navigation.navigate('TwoFactor', { email: variables.email, password: variables.password });
          return;
        }
        captureError(err, { screen: 'RegisterScreen', action: 'autoLogin' });
        setAutoLoginFailed(true);
      }
    },
    onError: (error) => {
      captureError(error, { screen: 'RegisterScreen', action: 'register' });
      setServerError(t('ErrorRegistrationFailed'));
    },
  });

  if (autoLoginFailed) {
    return (
      <GlassScreen dark={dark}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthHero dark={dark} subtitle={t('PleaseSignIn')} />
          <GlassCard dark={dark} radius={28} style={styles.card}>
            <Text style={[styles.cardTitle, { color: ink }]}>{t('ErrorAutoLoginFailed')}</Text>
            <AuroraPrimaryButton
              label={t('ButtonSignIn')}
              onPress={() => navigation.navigate('Login')}
              icon="arrow-right"
            />
          </GlassCard>
        </ScrollView>
      </GlassScreen>
    );
  }

  return (
    <GlassScreen dark={dark}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthHero dark={dark} subtitle={t('PleaseSignUp')} />

          <GlassCard dark={dark} radius={28} style={styles.card}>
            <Text style={[styles.cardTitle, { color: ink }]}>{t('ButtonRegister')}</Text>
            <Text style={[styles.cardSubtitle, { color: ink2 }]}>
              {t('LabelStartOrganizing') ?? 'Start organising your money today'}
            </Text>

            <Controller
              control={control}
              name="email"
              rules={{ required: t('RequiredField'), pattern: { value: /\S+@\S+\.\S+/, message: t('InvalidEmail') } }}
              render={({ field: { onChange, value } }) => (
                <AuroraField dark={dark} icon="email-outline" placeholder={t('FieldEmailAddress')}
                  value={value} onChangeText={onChange} keyboardType="email-address"
                  autoCapitalize="none" autoCorrect={false} hasError={!!errors.email} />
              )}
            />
            {errors.email && <HelperText type="error">{errors.email.message}</HelperText>}

            <Controller
              control={control}
              name="password"
              rules={{ required: t('RequiredField'), pattern: { value: PASSWORD_REGEX, message: t('PasswordRequirements') } }}
              render={({ field: { onChange, value } }) => (
                <AuroraField dark={dark} icon="lock-outline" placeholder={t('FieldPassword')}
                  value={value} onChangeText={onChange} secureTextEntry={!showPassword}
                  onToggleSecure={() => setShowPassword(v => !v)} showSecure={showPassword}
                  hasError={!!errors.password} />
              )}
            />
            {errors.password && <HelperText type="error">{errors.password.message}</HelperText>}

            <Controller
              control={control}
              name="confirmPassword"
              rules={{ required: t('RequiredField'), validate: v => v === passwordValue || t('PasswordsMustMatch') }}
              render={({ field: { onChange, value } }) => (
                <AuroraField dark={dark} icon="lock-reset" placeholder={t('FieldConfirmPassword')}
                  value={value} onChangeText={onChange} secureTextEntry hasError={!!errors.confirmPassword} />
              )}
            />
            {errors.confirmPassword && <HelperText type="error">{errors.confirmPassword.message}</HelperText>}
            {serverError && <HelperText type="error">{serverError}</HelperText>}

            <AuroraPrimaryButton
              label={t('ButtonRegister')}
              onPress={handleSubmit(v => { setServerError(null); registerMutation.mutate(v); })}
              loading={registerMutation.isPending}
              icon="arrow-right"
            />

            <Text style={[styles.terms, { color: ink2 }]}>
              {t('LabelTermsPrefix')}{' '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://econoflow.pt/use-terms')}
              >
                {t('UseTerms')}
              </Text>
              {t('LabelTermsMid')}{' '}
              <Text
                style={styles.termsLink}
                onPress={() => Linking.openURL('https://econoflow.pt/privacy-policy')}
              >
                {t('PrivacyPolicy')}
              </Text>
              {t('LabelTermsSuffix')}
            </Text>
          </GlassCard>

          <View style={styles.bottomRow}>
            <Text style={[styles.bottomText, { color: ink2 }]}>
              {t('LabelAlreadyHaveAccount') ?? 'Already have an account?'}
            </Text>
            <Text style={[styles.link, { color: '#0f76a8' }]} onPress={() => navigation.navigate('Login')}>
              {' '}{t('ButtonSignIn')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  flex:     { flex: 1 },
  scroll:   { flexGrow: 1, justifyContent: 'center', paddingVertical: 40 },
  card: {
    marginHorizontal: 20,
    padding: 22,
  },
  cardTitle:    { fontSize: 19, fontWeight: '800', marginBottom: 2 },
  cardSubtitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  bottomRow:    { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  bottomText:   { fontSize: 13.5 },
  link:         { fontSize: 13.5, fontWeight: '800' },
  terms:        { fontSize: 11.5, lineHeight: 17, textAlign: 'center', marginTop: 16, opacity: 0.82 },
  termsLink:    { color: '#0f76a8', fontWeight: '700' },
});
