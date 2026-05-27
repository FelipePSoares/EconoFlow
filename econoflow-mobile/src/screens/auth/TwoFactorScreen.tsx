import React, { useState } from 'react';
import { StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Button, Text, TextInput, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { mobileLogin } from '../../api/auth.api';
import { useAuthStore } from '../../store/authStore';
import { getCurrentUser } from '../../api/auth.api';
import i18n from '../../i18n';

type Props = NativeStackScreenProps<AuthStackParamList, 'TwoFactor'>;

interface FormValues {
  code: string;
}

export const TwoFactorScreen: React.FC<Props> = ({ route }) => {
  const { t } = useTranslation();
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
      } catch {
        // proceed
      }
    },
    onError: () => setAuthError(t('ErrorInvalidTwoFactorCode') ?? 'Invalid code'),
  });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text variant="headlineMedium" style={styles.title}>
          {t('LabelTwoFactorAuthentication') ?? 'Two-factor authentication'}
        </Text>
        <Text style={styles.subtitle}>
          {t('LabelEnterTwoFactorCode') ?? 'Enter the code from your authenticator app.'}
        </Text>

        <Controller
          control={control}
          name="code"
          rules={{ required: t('RequiredField') ?? 'Required' }}
          render={({ field: { onChange, value } }) => (
            <TextInput
              label={t('FieldTwoFactorCode')}
              value={value}
              onChangeText={onChange}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              style={styles.input}
              error={!!errors.code}
            />
          )}
        />
        {errors.code && <HelperText type="error">{errors.code.message}</HelperText>}
        {authError && <HelperText type="error">{authError}</HelperText>}

        <Button
          mode="contained"
          onPress={handleSubmit((v) => { setAuthError(null); mutation.mutate(v); })}
          loading={mutation.isPending}
          disabled={mutation.isPending}
          style={styles.button}
        >
          {t('ButtonVerify') ?? 'Verify'}
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
});
