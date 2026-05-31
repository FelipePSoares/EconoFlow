import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Button, Text, TextInput, HelperText, useTheme } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { register } from '../../api/auth.api';
import { AuthHero } from '../../components/auth/AuthHero';

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
  const theme = useTheme();
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  // eslint-disable-next-line react-hooks/incompatible-library
  const passwordValue = watch('password');

  const registerMutation = useMutation({
    mutationFn: (values: FormValues) => register(values.email, values.password),
    onSuccess: () => setSuccess(true),
    onError: () => setServerError(t('ErrorRegistrationFailed')),
  });

  if (success) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <AuthHero subtitle={t('LabelCheckYourEmail')} />
          <View style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
            <Text variant="headlineSmall" style={styles.successTitle}>
              {t('LabelCheckYourEmail')}
            </Text>
            <Text style={[styles.successSubtitle, { color: theme.colors.onSurface }]}>
              {t('LabelConfirmEmailSent')}
            </Text>
            <Button
              mode="contained"
              onPress={() => navigation.navigate('Login')}
              style={styles.button}
              contentStyle={styles.buttonContent}
            >
              {t('ButtonSignIn')}
            </Button>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <AuthHero subtitle={t('PleaseSignUp')} />

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
                autoComplete="email"
                textContentType="emailAddress"
                style={styles.input}
                error={!!errors.email}
              />
            )}
          />
          {errors.email && <HelperText type="error">{errors.email.message}</HelperText>}

          <Controller
            control={control}
            name="password"
            rules={{
              required: t('RequiredField'),
              pattern: { value: PASSWORD_REGEX, message: t('PasswordRequirements') },
            }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                label={t('FieldPassword')}
                value={value}
                onChangeText={onChange}
                secureTextEntry={!showPassword}
                autoComplete="new-password"
                textContentType="newPassword"
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

          <Controller
            control={control}
            name="confirmPassword"
            rules={{
              required: t('RequiredField'),
              validate: (v) => v === passwordValue || t('PasswordsMustMatch'),
            }}
            render={({ field: { onChange, value } }) => (
              <TextInput
                label={t('FieldConfirmPassword')}
                value={value}
                onChangeText={onChange}
                secureTextEntry
                autoComplete="new-password"
                textContentType="newPassword"
                style={styles.input}
                error={!!errors.confirmPassword}
              />
            )}
          />
          {errors.confirmPassword && (
            <HelperText type="error">{errors.confirmPassword.message}</HelperText>
          )}

          {serverError && <HelperText type="error">{serverError}</HelperText>}

          <Button
            mode="contained"
            onPress={handleSubmit((v) => { setServerError(null); registerMutation.mutate(v); })}
            loading={registerMutation.isPending}
            disabled={registerMutation.isPending}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {t('ButtonRegister')}
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('Login')}
            style={styles.link}
          >
            {t('LinkSignIn')}
          </Button>
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
  successTitle: { textAlign: 'center', marginBottom: 12, fontWeight: 'bold' },
  successSubtitle: { textAlign: 'center', marginBottom: 24, opacity: 0.7 },
  input: { marginBottom: 2 },
  button: { marginTop: 20, borderRadius: 8 },
  buttonContent: { paddingVertical: 6 },
  link: { marginTop: 8, alignSelf: 'center' },
});
