import React, { useState } from 'react';
import {
  View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { Text, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { AuthStackParamList } from '../../navigation/AuthNavigator';
import { register } from '../../api/auth.api';
import { AuthHero } from '../../components/auth/AuthHero';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { GlassCard } from '../../components/common/GlassCard';
import { GlassScreen } from '../../components/common/GlassScreen';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

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
  const { dark, ink, ink2 } = useAuroraSkin();
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
      <GlassScreen dark={dark}>
        <AuthHero dark={dark} subtitle={t('LabelCheckYourEmail')} />
        <GlassCard dark={dark} radius={26} style={styles.card}>
          <Text style={[styles.successTitle, { color: ink }]}>{t('LabelCheckYourEmail')}</Text>
          <Text style={[styles.successSub, { color: ink2 }]}>{t('LabelConfirmEmailSent')}</Text>
          <AuroraPrimaryButton label={t('ButtonSignIn')} onPress={() => navigation.navigate('Login')} />
        </GlassCard>
      </GlassScreen>
    );
  }

  return (
    <GlassScreen dark={dark}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <AuthHero dark={dark} subtitle={t('PleaseSignUp')} />

          <GlassCard dark={dark} radius={26} style={styles.card}>
            <Text style={[styles.cardTitle, { color: ink }]}>{t('ButtonRegister')}</Text>
          <Text style={[styles.cardSubtitle, { color: ink2 }]}>
            {t('LabelStartOrganizing') ?? 'Start organising your money today'}
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

          <Controller
            control={control}
            name="password"
            rules={{ required: t('RequiredField'), pattern: { value: PASSWORD_REGEX, message: t('PasswordRequirements') } }}
            render={({ field: { onChange, value } }) => (
              <AuroraField dark={dark} icon="lock-outline" placeholder={t('FieldPassword')}
                value={value} onChangeText={onChange} secureTextEntry={!showPassword}
                onToggleSecure={() => setShowPassword(v => !v)} showSecure={showPassword}
                hasError={!!errors.password} />
            )}
          />
          {errors.password && <HelperText type="error">{errors.password.message}</HelperText>}

          <Controller
            control={control}
            name="confirmPassword"
            rules={{ required: t('RequiredField'), validate: v => v === passwordValue || t('PasswordsMustMatch') }}
            render={({ field: { onChange, value } }) => (
              <AuroraField dark={dark} icon="lock-reset" placeholder={t('FieldConfirmPassword')}
                value={value} onChangeText={onChange} secureTextEntry hasError={!!errors.confirmPassword} />
            )}
          />
          {errors.confirmPassword && <HelperText type="error">{errors.confirmPassword.message}</HelperText>}
          {serverError && <HelperText type="error">{serverError}</HelperText>}

          <AuroraPrimaryButton
            label={t('ButtonRegister')}
            onPress={handleSubmit(v => { setServerError(null); registerMutation.mutate(v); })}
            loading={registerMutation.isPending}
          />
          </GlassCard>

          <View style={styles.bottomRow}>
          <Text style={[styles.bottomText, { color: ink2 }]}>
            {t('LabelAlreadyHaveAccount') ?? 'Already have an account?'}
          </Text>
          <Text style={[styles.link, { color: '#0f76a8' }]} onPress={() => navigation.navigate('Login')}>
            {' '}{t('ButtonSignIn')}
          </Text>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  flex:     { flex: 1 },
  scroll:   { flexGrow: 1, paddingBottom: 40 },
  card: {
    marginHorizontal: 20,
    marginTop: -16,
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 12,
  },
  cardTitle:    { fontSize: 19, fontWeight: '800', marginBottom: 2 },
  cardSubtitle: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  successTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  successSub:   { fontSize: 13.5, textAlign: 'center', lineHeight: 20, marginBottom: 6 },
  bottomRow:    { flexDirection: 'row', justifyContent: 'center', marginTop: 22 },
  bottomText:   { fontSize: 13.5 },
  link:         { fontSize: 13.5, fontWeight: '800' },
});
