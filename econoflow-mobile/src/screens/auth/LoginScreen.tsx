import React, { useState } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { Text, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
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

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

interface FormValues {
  email: string;
  password: string;
}

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { setTokens, setUser } = useAuthStore();
  const [loginError, setLoginError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useMutation({
    mutationFn: (values: FormValues) =>
      mobileLogin({ email: values.email, password: values.password }),
    onSuccess: async (response, variables) => {
      const { accessToken, refreshToken } = response.data;
      if (typeof accessToken !== 'string' || !accessToken) {
        const body = response.data as unknown as { requiresTwoFactor?: boolean };
        if (body?.requiresTwoFactor) {
          navigation.navigate('TwoFactor', { email: variables.email, password: variables.password });
          return;
        }
        setLoginError(t('ErrorInvalidCredentials'));
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
    },
    onError: (err: { response?: { data?: { requiresTwoFactor?: boolean } } }, variables) => {
      if (err?.response?.data?.requiresTwoFactor) {
        navigation.navigate('TwoFactor', { email: variables.email, password: variables.password });
        return;
      }
      setLoginError(t('ErrorInvalidCredentials'));
    },
  });

  return (
    <GlassScreen dark={dark}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthHero dark={dark} subtitle={t('PleaseSignIn')} />

          <GlassCard dark={dark} radius={26} style={styles.card}>
            <Text style={[styles.cardTitle, { color: ink }]}>{t('ButtonSignIn')}</Text>
            <Text style={[styles.cardSubtitle, { color: ink2 }]}>{t('PleaseSignIn')}</Text>

            <Controller
              control={control}
              name="email"
              rules={{
                required: t('RequiredField'),
                pattern: { value: /\S+@\S+\.\S+/, message: t('InvalidEmail') },
              }}
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
              rules={{ required: t('RequiredField') }}
              render={({ field: { onChange, value } }) => (
                <AuroraField dark={dark} icon="lock-outline" placeholder={t('FieldPassword')}
                  value={value} onChangeText={onChange} secureTextEntry={!showPassword}
                  onToggleSecure={() => setShowPassword(v => !v)} showSecure={showPassword}
                  hasError={!!errors.password} />
              )}
            />
            {errors.password && <HelperText type="error">{errors.password.message}</HelperText>}
            {loginError && <HelperText type="error">{loginError}</HelperText>}

            <View style={styles.forgotRow}>
              <Text style={[styles.link, { color: '#0f76a8' }]}
                onPress={() => navigation.navigate('ForgotPassword')}>
                {t('LinkForgotPassword')}
              </Text>
            </View>

            <AuroraPrimaryButton
              label={t('ButtonSignIn')}
              onPress={handleSubmit(v => { setLoginError(null); loginMutation.mutate(v); })}
              loading={loginMutation.isPending}
            />
          </GlassCard>

          <View style={styles.bottomRow}>
            <Text style={[styles.bottomText, { color: ink2 }]}>
              {t('LabelNoAccount') ?? "Don't have an account?"}
            </Text>
            <Text style={[styles.link, { color: '#0f76a8' }]}
              onPress={() => navigation.navigate('Register')}>
              {' '}{t('LinkCreateAccount')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  flex:  { flex: 1 },
  scroll:{ flexGrow: 1, paddingBottom: 40 },
  card: {
    marginHorizontal: 20,
    marginTop: -16,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 12,
  },
  cardTitle:    { fontSize: 19, fontWeight: '800', marginBottom: 2 },
  cardSubtitle: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  forgotRow:    { alignItems: 'flex-end', marginTop: 6, marginBottom: 4 },
  bottomRow:    { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  bottomText:   { fontSize: 13.5 },
  link:         { fontSize: 13.5, fontWeight: '800' },
});
