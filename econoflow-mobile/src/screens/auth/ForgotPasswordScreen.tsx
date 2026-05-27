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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { forgotPassword } from '../../api/auth.api';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const theme = useTheme();
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
      <View style={[styles.flex, styles.center, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text variant="headlineSmall" style={styles.title}>
            {t('LabelCheckYourEmail')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurface }]}>
            {t('LabelPasswordResetSent')}
          </Text>
          <Button
            mode="contained"
            onPress={() => navigation.navigate('Login')}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {t('ButtonBackToLogin')}
          </Button>
        </View>
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
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <Text variant="headlineMedium" style={styles.title}>
            {t('LabelForgotPassword')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.onSurface }]}>
            {t('LabelForgotPasswordDescription')}
          </Text>

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

          <Button
            mode="contained"
            onPress={handleSubmit((v) => mutation.mutate(v))}
            loading={mutation.isPending}
            disabled={mutation.isPending}
            style={styles.button}
            contentStyle={styles.buttonContent}
          >
            {t('ButtonSendResetLink')}
          </Button>

          <Button
            mode="text"
            onPress={() => navigation.navigate('Login')}
            style={styles.link}
          >
            {t('ButtonBackToLogin')}
          </Button>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { justifyContent: 'center', padding: 20 },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 20 },
  card: {
    borderRadius: 16,
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: { textAlign: 'center', marginBottom: 8, fontWeight: 'bold' },
  subtitle: { textAlign: 'center', marginBottom: 28, opacity: 0.7 },
  input: { marginBottom: 4 },
  button: { marginTop: 20, borderRadius: 8 },
  buttonContent: { paddingVertical: 6 },
  link: { marginTop: 8, alignSelf: 'center' },
});
