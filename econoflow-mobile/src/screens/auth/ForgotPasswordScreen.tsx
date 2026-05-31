import React, { useState } from 'react';
import {
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, View, useColorScheme,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { forgotPassword } from '../../api/auth.api';
import { AuthHero } from '../../components/auth/AuthHero';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const dark = useColorScheme() === 'dark';
  const [sent, setSent] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<{ email: string }>({
    defaultValues: { email: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: { email: string }) => forgotPassword(values.email),
    onSuccess: () => setSent(true),
  });

  const ink  = dark ? '#e6edf3' : '#0d2137';
  const ink2 = dark ? '#8aa0b6' : '#5b6b7c';
  const bg   = dark ? '#061e33' : '#e6eff6';
  const cardBg = dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.72)';
  const cardBorder = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.85)';

  if (sent) {
    return (
      <View style={[styles.flex, { backgroundColor: bg }]}>
        <AuthHero dark={dark} subtitle={t('LabelCheckYourEmail')} />
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          {/* Success icon */}
          <View style={styles.successIconWrap}>
            <MaterialCheckIcon />
          </View>
          <Text style={[styles.successTitle, { color: ink }]}>{t('LabelCheckYourEmail')}</Text>
          <Text style={[styles.successSub, { color: ink2 }]}>{t('LabelPasswordResetSent')}</Text>
          <AuroraPrimaryButton
            label={t('ButtonBackToLogin')}
            onPress={() => navigation.navigate('Login')}
          />
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthHero dark={dark} subtitle={t('LabelForgotPassword')} />

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
          <Text style={[styles.cardTitle, { color: ink }]}>{t('ForgotPassword')}</Text>
          <Text style={[styles.description, { color: ink2 }]}>
            {t('LabelForgotPasswordDescription')}
          </Text>

          <Controller
            control={control}
            name="email"
            rules={{ required: t('RequiredField'), pattern: { value: /\S+@\S+\.\S+/, message: t('InvalidEmail') } }}
            render={({ field: { onChange, value } }) => (
              <AuroraField dark={dark} icon="email-outline" placeholder={t('FieldEmailAddress')}
                value={value} onChangeText={onChange} keyboardType="email-address"
                autoCapitalize="none" autoCorrect={false} hasError={!!errors.email} />
            )}
          />
          {errors.email && <HelperText type="error">{errors.email.message}</HelperText>}

          <AuroraPrimaryButton
            label={t('ButtonSendResetLink')}
            onPress={handleSubmit(v => mutation.mutate(v))}
            loading={mutation.isPending}
          />
        </View>

        <View style={styles.bottomRow}>
          <Text style={[styles.bottomText, { color: ink2 }]}>
            {t('LabelRememberedPassword') ?? 'Remembered it?'}
          </Text>
          <Text style={[styles.link, { color: '#0f76a8' }]} onPress={() => navigation.navigate('Login')}>
            {' '}{t('ButtonBackToLogin')}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const MaterialCheckIcon: React.FC = () => (
  <View style={styles.successIconCircle}>
    <MaterialCommunityIcons name="email-check-outline" size={40} color="#fff" />
  </View>
);

const styles = StyleSheet.create({
  flex:   { flex: 1 },
  scroll: { flexGrow: 1, paddingBottom: 40 },
  card: {
    marginHorizontal: 20,
    marginTop: -20,
    borderRadius: 26,
    padding: 22,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 40,
    elevation: 12,
  },
  cardTitle:   { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  description: { fontSize: 13, lineHeight: 19, marginBottom: 6 },
  successIconWrap:   { alignItems: 'center', marginBottom: 16 },
  successIconCircle: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: '#0e9f6e',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'rgba(14,159,110,0.45)',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1,
    shadowRadius: 30,
    elevation: 10,
  },
  successTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  successSub:   { fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  bottomRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  bottomText: { fontSize: 13.5 },
  link:       { fontSize: 13.5, fontWeight: '800' },
});
