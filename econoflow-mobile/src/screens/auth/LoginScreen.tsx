import React, { useState } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { Button, TextInput, HelperText, useTheme } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { mobileLogin, getCurrentUser } from '../../api/auth.api';
import { useAuthStore } from '../../store/authStore';
import i18n from '../../i18n';
import { AuthHero } from '../../components/auth/AuthHero';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'Login'>;
};

interface FormValues {
  email: string;
  password: string;
}

export const LoginScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const theme = useTheme();
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
          navigation.navigate('TwoFactor', {
            email: variables.email,
            password: variables.password,
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
        // proceed without user profile
      }
    },
    onError: (err: { response?: { data?: { requiresTwoFactor?: boolean } } }, variables) => {
      if (err?.response?.data?.requiresTwoFactor) {
        navigation.navigate('TwoFactor', {
          email: variables.email,
          password: variables.password,
        });
        return;
      }
      setLoginError(t('ErrorInvalidCredentials'));
    },
  });

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <AuthHero subtitle={t('PleaseSignIn')} />

        <View style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
          <Controller
            control={control}
            name="email"
            rules={{
              required: t('RequiredField'),
              pattern: { value: /\S+@\S+\.\S+/, message: t('InvalidEmail') },
            }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                label={t('FieldEmailAddress')}
                value={value}
                onChangeText={onChange}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
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
                secureTextEntry={!showPassword}
                autoComplete="current-password"
                textContentType="password"
                right={
                  <TextInput.Icon
                    icon={showPassword ? 'eye-off' : 'eye'}
                    onPress={() => setShowPassword((v) => !v)}
                  />
                }
                style={styles.input}
                error={!!errors.password}
              />
            )}
          />
          {errors.password && <HelperText type="error">{errors.password.message}</HelperText>}

          {loginError && (
            <HelperText type="error" style={styles.errorText}>{loginError}</HelperText>
          )}

          <Button
            mode="contained"
            onPress={handleSubmit((values) => {
              setLoginError(null);
              loginMutation.mutate(values);
            })}
            loading={loginMutation.isPending}
            disabled={loginMutation.isPending}
            style={styles.signInButton}
            contentStyle={styles.signInButtonContent}
            color={theme.colors.primary}
          >
            {t('ButtonSignIn')}
          </Button>

          <View style={styles.links}>
            <Button
              mode="text"
              compact
              onPress={() => navigation.navigate('ForgotPassword')}
            >
              {t('LinkForgotPassword')}
            </Button>
            <Button
              mode="text"
              compact
              onPress={() => navigation.navigate('Register')}
            >
              {t('LinkCreateAccount')}
            </Button>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1 },
  card: {
    marginHorizontal: 20,
    marginTop: -16,
    borderRadius: 16,
    padding: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  input: { marginBottom: 2 },
  errorText: { marginBottom: 4 },
  signInButton: { marginTop: 20, borderRadius: 8 },
  signInButtonContent: { paddingVertical: 6 },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
});
