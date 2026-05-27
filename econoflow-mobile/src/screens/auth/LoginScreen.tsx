import React, { useState } from 'react';
import { Image, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, useColorScheme } from 'react-native';
import { Button, TextInput, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { mobileLogin } from '../../api/auth.api';
import { useAuthStore } from '../../store/authStore';
import { getCurrentUser } from '../../api/auth.api';
import i18n from '../../i18n';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

interface FormValues {
  email: string;
  password: string;
}

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { setTokens, setUser } = useAuthStore();
  const [loginError, setLoginError] = useState<string | null>(null);
  const colorScheme = useColorScheme();
  const logoSource = colorScheme === 'dark'
    ? require('../../../assets/logo-dark.png')
    : require('../../../assets/logo-light.png');

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { email: '', password: '' },
  });

  const loginMutation = useMutation({
    mutationFn: (values: FormValues) =>
      mobileLogin({ email: values.email, password: values.password }),
    onSuccess: async (response) => {
      const { accessToken, refreshToken } = response.data;

      if (typeof accessToken !== 'string' || !accessToken) {
        const body = response.data as unknown as { code?: string; requiresTwoFactor?: boolean };
        if (body?.requiresTwoFactor) {
          navigation.navigate('TwoFactor', {
            email: '',
            password: '',
          });
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
      } catch {
        // proceed without user profile — will be loaded on next request
      }
    },
    onError: (err: { response?: { data?: { code?: string; requiresTwoFactor?: boolean } } }) => {
      const data = err?.response?.data;
      if (data?.requiresTwoFactor) {
        navigation.navigate('TwoFactor', { email: '', password: '' });
        return;
      }
      setLoginError(t('ErrorInvalidCredentials'));
    },
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Image source={logoSource} style={styles.logo} resizeMode="contain" />

        <Controller
          control={control}
          name="email"
          rules={{ required: t('RequiredField'), pattern: { value: /\S+@\S+\.\S+/, message: t('InvalidEmail') } }}
          render={({ field: { onChange, value } }) => (
            <TextInput
              label={t('FieldEmailAddress')}
              value={value}
              onChangeText={onChange}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
              style={styles.input}
              error={!!errors.email}
            />
          )}
        />
        {errors.email && <HelperText type="error">{errors.email.message}</HelperText>}

        <Controller
          control={control}
          name="password"
          rules={{ required: t('RequiredField') }}
          render={({ field: { onChange, value } }) => (
            <TextInput
              label={t('FieldPassword')}
              value={value}
              onChangeText={onChange}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              style={styles.input}
              error={!!errors.password}
            />
          )}
        />
        {errors.password && <HelperText type="error">{errors.password.message}</HelperText>}

        {loginError && <HelperText type="error" style={styles.errorText}>{loginError}</HelperText>}

        <Button
          mode="contained"
          onPress={handleSubmit((values) => { setLoginError(null); loginMutation.mutate(values); })}
          loading={loginMutation.isPending}
          disabled={loginMutation.isPending}
          style={styles.button}
        >
          {t('ButtonSignIn')}
        </Button>

        <Button mode="text" onPress={() => navigation.navigate('ForgotPassword')} style={styles.link}>
          {t('LinkForgotPassword')}
        </Button>

        <Button mode="text" onPress={() => navigation.navigate('Register')} style={styles.link}>
          {t('LinkCreateAccount')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 4 },
  logo: { width: 200, height: 80, alignSelf: 'center', marginBottom: 24 },
  input: { marginBottom: 4 },
  button: { marginTop: 16 },
  link: { marginTop: 4 },
  errorText: { marginBottom: 8 },
});
