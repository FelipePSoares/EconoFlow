import React, { useState } from 'react';
import { Image, View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, useColorScheme } from 'react-native';
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
  const colorScheme = useColorScheme();
  const logoSource = colorScheme === 'dark'
    ? require('../../../assets/logo-dark.png')
    : require('../../../assets/logo-light.png');

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
      <View style={styles.container}>
        <Image source={logoSource} style={styles.logo} resizeMode="contain" />
        <Text variant="headlineSmall" style={styles.title}>
          {t('LabelCheckYourEmail')}
        </Text>
        <Text style={styles.subtitle}>
          {t('LabelConfirmEmailSent')}
        </Text>
        <Button mode="contained" onPress={() => navigation.navigate('Login')} style={styles.button}>
          {t('ButtonSignIn')}
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
        <Image source={logoSource} style={styles.logo} resizeMode="contain" />

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
            pattern: {
              value: PASSWORD_REGEX,
              message: t('PasswordRequirements'),
            },
          }}
          render={({ field: { onChange, value } }) => (
            <TextInput
              label={t('FieldPassword')}
              value={value}
              onChangeText={onChange}
              secureTextEntry
              autoComplete="new-password"
              textContentType="newPassword"
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
        {errors.confirmPassword && <HelperText type="error">{errors.confirmPassword.message}</HelperText>}

        {serverError && <HelperText type="error">{serverError}</HelperText>}

        <Button
          mode="contained"
          onPress={handleSubmit((v) => { setServerError(null); registerMutation.mutate(v); })}
          loading={registerMutation.isPending}
          disabled={registerMutation.isPending}
          style={styles.button}
        >
          {t('ButtonRegister')}
        </Button>

        <Button mode="text" onPress={() => navigation.navigate('Login')} style={styles.link}>
          {t('LinkSignIn')}
        </Button>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 4 },
  logo: { width: 200, height: 80, alignSelf: 'center', marginBottom: 24 },
  title: { textAlign: 'center', marginBottom: 16, fontWeight: 'bold' },
  subtitle: { textAlign: 'center', marginBottom: 24 },
  input: { marginBottom: 4 },
  button: { marginTop: 16 },
  link: { marginTop: 4 },
});
