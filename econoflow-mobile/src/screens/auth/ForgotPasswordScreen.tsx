import React, { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, Text, TextInput, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { forgotPassword } from '../../api/auth.api';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<{ email: string }>({
    defaultValues: { email: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: { email: string }) => forgotPassword(values.email),
    onSuccess: () => setSent(true),
  });

  if (sent) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="headlineSmall" style={styles.title}>
          {t('LabelCheckYourEmail') ?? 'Check your email'}
        </Text>
        <Text style={styles.subtitle}>
          {t('LabelPasswordResetSent') ?? 'If that email is registered, we sent reset instructions.'}
        </Text>
        <Button mode="text" onPress={() => navigation.navigate('Login')}>
          {t('ButtonBackToLogin') ?? 'Back to login'}
        </Button>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>
          {t('LabelForgotPassword') ?? 'Forgot password?'}
        </Text>
        <Text style={styles.subtitle}>
          {t('LabelForgotPasswordDescription') ?? 'Enter your email and we\'ll send you a reset link.'}
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

        <Button
          mode="contained"
          onPress={handleSubmit((v) => mutation.mutate(v))}
          loading={mutation.isPending}
          disabled={mutation.isPending}
          style={styles.button}
        >
          {t('ButtonSendResetLink') ?? 'Send reset link'}
        </Button>

        <Button mode="text" onPress={() => navigation.navigate('Login')} style={styles.link}>
          {t('ButtonBackToLogin') ?? 'Back to login'}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 4 },
  title: { textAlign: 'center', marginBottom: 8, fontWeight: 'bold' },
  subtitle: { textAlign: 'center', marginBottom: 24 },
  input: { marginBottom: 4 },
  button: { marginTop: 16 },
  link: { marginTop: 4 },
});
