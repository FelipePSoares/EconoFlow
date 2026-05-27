import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, Text, TextInput, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { register } from '../../api/auth.api';

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
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    defaultValues: { email: '', password: '', confirmPassword: '' },
  });

  const passwordValue = watch('password');

  const registerMutation = useMutation({
    mutationFn: (values: FormValues) => register(values.email, values.password),
    onSuccess: () => setSuccess(true),
    onError: () => setServerError(t('ErrorRegistrationFailed') ?? 'Registration failed. Please try again.'),
  });

  if (success) {
    return (
      <View style={styles.container}>
        <Text variant="headlineSmall" style={styles.title}>
          {t('LabelCheckYourEmail') ?? 'Check your email'}
        </Text>
        <Text style={styles.subtitle}>
          {t('LabelConfirmEmailSent') ?? 'We sent a confirmation link to your email address.'}
        </Text>
        <Button mode="contained" onPress={() => navigation.navigate('Login')} style={styles.button}>
          {t('ButtonSignIn') ?? 'Sign in'}
        </Button>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>
          {t('LabelCreateAccount') ?? 'Create account'}
        </Text>

        <Controller
          control={control}
          name="email"
          rules={{
            required: t('RequiredField') ?? 'Required',
            pattern: { value: /\S+@\S+\.\S+/, message: t('InvalidEmail') ?? 'Invalid email' },
          }}
          render={({ field: { onChange, value } }) => (
            <TextInput
              label={t('FieldEmailAddress') ?? 'Email'}
              value={value}
              onChangeText={onChange}
              keyboardType="email-address"
              autoCapitalize="none"
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
            required: t('RequiredField') ?? 'Required',
            pattern: {
              value: PASSWORD_REGEX,
              message: t('PasswordRequirements') ?? 'Min 8 chars with uppercase, lowercase, digit, and symbol',
            },
          }}
          render={({ field: { onChange, value } }) => (
            <TextInput
              label={t('FieldPassword') ?? 'Password'}
              value={value}
              onChangeText={onChange}
              secureTextEntry
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
            required: t('RequiredField') ?? 'Required',
            validate: (v) => v === passwordValue || (t('PasswordsMustMatch') ?? 'Passwords must match'),
          }}
          render={({ field: { onChange, value } }) => (
            <TextInput
              label={t('FieldConfirmPassword') ?? 'Confirm password'}
              value={value}
              onChangeText={onChange}
              secureTextEntry
              style={styles.input}
              error={!!errors.confirmPassword}
            />
          )}
        />
        {errors.confirmPassword && <HelperText type="error">{errors.confirmPassword.message}</HelperText>}

        {serverError && <HelperText type="error">{serverError}</HelperText>}

        <Button
          mode="contained"
          onPress={handleSubmit((v) => { setServerError(null); registerMutation.mutate(v); })}
          loading={registerMutation.isPending}
          disabled={registerMutation.isPending}
          style={styles.button}
        >
          {t('ButtonRegister') ?? 'Register'}
        </Button>

        <Button mode="text" onPress={() => navigation.navigate('Login')} style={styles.link}>
          {t('LinkSignIn') ?? 'Already have an account? Sign in'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 4 },
  title: { textAlign: 'center', marginBottom: 16, fontWeight: 'bold' },
  subtitle: { textAlign: 'center', marginBottom: 24 },
  input: { marginBottom: 4 },
  button: { marginTop: 16 },
  link: { marginTop: 4 },
});
