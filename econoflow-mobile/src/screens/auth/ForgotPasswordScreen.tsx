import React, { useState } from 'react';
import {
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, View,
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
import { GlassCard } from '../../components/common/GlassCard';
import { GlassScreen } from '../../components/common/GlassScreen';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

type Props = {
  navigation: NativeStackNavigationProp<AuthStackParamList, 'ForgotPassword'>;
};

export const ForgotPasswordScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const [sent, setSent] = useState(false);

  const { control, handleSubmit, formState: { errors } } = useForm<{ email: string }>({
    defaultValues: { email: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: { email: string }) => forgotPassword(values.email),
    // Always show the "check your email" screen whether the API succeeds or fails.
    // This prevents leaking whether an email address is registered (security best
    // practice) and fixes the silent no-op when the server returns an error.
    onSuccess: () => setSent(true),
    onError:   () => setSent(true),
  });

  if (sent) {
    return (
      <GlassScreen dark={dark}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthHero dark={dark} subtitle={t('LabelCheckYourEmail')} />
          <GlassCard dark={dark} radius={28} style={styles.card}>
            <View style={styles.successIconWrap}>
              <View style={styles.successIconCircle}>
                <MaterialCommunityIcons name="email-check-outline" size={40} color="#fff" />
              </View>
            </View>
            <Text style={[styles.successTitle, { color: ink }]}>{t('LabelCheckYourEmail')}</Text>
            <Text style={[styles.successSub, { color: ink2 }]}>{t('LabelPasswordResetSent')}</Text>
            <AuroraPrimaryButton
              label={t('ButtonBackToLogin')}
              onPress={() => navigation.navigate('Login')}
              icon="arrow-right"
            />
          </GlassCard>
        </ScrollView>
      </GlassScreen>
    );
  }

  return (
    <GlassScreen dark={dark}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthHero dark={dark} subtitle={t('LabelForgotPassword')} />

          <GlassCard dark={dark} radius={28} style={styles.card}>
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
              icon="arrow-right"
            />
          </GlassCard>

          <View style={styles.bottomRow}>
            <Text style={[styles.bottomText, { color: ink2 }]}>
              {t('LabelRememberedPassword') ?? 'Remembered it?'}
            </Text>
            <Text style={[styles.link, { color: '#0f76a8' }]}
              onPress={() => navigation.navigate('Login')}>
              {' '}{t('ButtonBackToLogin')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  flex:   { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingVertical: 40 },
  card: {
    marginHorizontal: 20,
    padding: 22,
  },
  cardTitle:   { fontSize: 19, fontWeight: '800', marginBottom: 4 },
  description: { fontSize: 13, lineHeight: 19, marginBottom: 6 },
  successIconWrap:   { alignItems: 'center', marginBottom: 16 },
  successIconCircle: {
    width: 84, height: 84, borderRadius: 28,
    backgroundColor: '#0e9f6e',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: 'rgba(14,159,110,0.45)',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 1, shadowRadius: 30, elevation: 10,
  },
  successTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  successSub:   { fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  bottomRow:  { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  bottomText: { fontSize: 13.5 },
  link:       { fontSize: 13.5, fontWeight: '800' },
});
