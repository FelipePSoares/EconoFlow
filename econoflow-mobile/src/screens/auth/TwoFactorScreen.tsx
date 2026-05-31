import React, { useState } from 'react';
import {
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { Button, Text, TextInput, HelperText, useTheme } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { mobileLogin, getCurrentUser } from '../../api/auth.api';
import { useAuthStore } from '../../store/authStore';
import i18n from '../../i18n';
import { AuthHero } from '../../components/auth/AuthHero';

type Props = NativeStackScreenProps<AuthStackParamList, 'TwoFactor'>;

interface FormValues {
  code: string;
}

export const TwoFactorScreen: React.FC<Props> = ({ route }) => {
  const { t } = useTranslation();
  const theme = useTheme();
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
    onError: () => setAuthError(t('ErrorInvalidTwoFactorCode')),
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
        <AuthHero subtitle={t('TwoFactorSignInTitle')} />

        <View style={[styles.card, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadow }]}>
          <Text variant="bodyMedium" style={[styles.description, { color: theme.colors.onSurfaceVariant }]}>
            {t('LabelEnterTwoFactorCode')}
          </Text>

          <Controller
            control={control}
            name="code"
            rules={{ required: t('RequiredField') }}
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
            contentStyle={styles.buttonContent}
          >
            {t('ButtonVerify')}
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
  title: { textAlign: 'center', marginBottom: 8, fontWeight: 'bold' },
  description: { textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  input: { marginBottom: 4 },
  button: { marginTop: 20, borderRadius: 8 },
  buttonContent: { paddingVertical: 6 },
});
