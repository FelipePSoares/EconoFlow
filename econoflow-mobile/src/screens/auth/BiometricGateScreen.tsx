import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootParamList } from '../../navigation/AppNavigator';
import { useAuthStore } from '../../store/authStore';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

type Props = NativeStackScreenProps<RootParamList, 'BiometricGate'>;

export const BiometricGateScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { clearAuth, needsOnboarding } = useAuthStore();
  const [state, setState] = useState<'loading' | 'authenticating' | 'failed' | 'locked' | 'done'>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const navigateAway = useCallback(() => {
    setState('done');
    const target = needsOnboarding ? 'Onboarding' : 'Main';
    navigation.reset({ index: 0, routes: [{ name: target }] });
  }, [needsOnboarding, navigation]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        if (!cancelled) {
          navigateAway();
        }
        return;
      }

      if (!cancelled) {
        setState('authenticating');
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('BiometricPromptReason'),
        cancelLabel: t('ButtonCancel'),
        disableDeviceFallback: false,
      });

      if (cancelled) return;

      if (result.success) {
        navigateAway();
      } else if (result.error === 'lockout') {
        setState('locked');
        setErrorMessage(t('BiometricErrorLockedOut'));
      } else {
        setState('failed');
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [navigateAway, t]);

  const handleSignOut = () => {
    clearAuth();
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  };

  const handleRetry = async () => {
    setState('authenticating');
    setErrorMessage(null);

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('BiometricPromptReason'),
      cancelLabel: t('ButtonCancel'),
      disableDeviceFallback: false,
    });

    if (result.success) {
      navigateAway();
    } else if (result.error === 'lockout') {
      setState('locked');
    } else {
      setState('failed');
    }
  };

  if (state === 'loading') {
    return (
      <GlassScreen dark={dark}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#0f76a8" />
        </View>
      </GlassScreen>
    );
  }

  return (
    <GlassScreen dark={dark}>
      <View style={styles.container}>
        <LinearGradient
          colors={['#0f76a8', '#14c08a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconWrap}
        >
          <MaterialCommunityIcons name="fingerprint" size={48} color="#fff" />
        </LinearGradient>

        <Text style={[styles.title, { color: ink }]}>
          {t('BiometricGateTitle')}
        </Text>
        <Text style={[styles.subtitle, { color: ink2 }]}>
          {t('BiometricGateSubtitle')}
        </Text>

        {(state === 'failed' || state === 'locked') && (
          <GlassCard dark={dark} radius={20} style={styles.card} testID="biometric-fallback">
            {state === 'locked' && (
              <View style={styles.errorSection} testID="biometric-lockout">
                <MaterialCommunityIcons name="lock-alert" size={32} color="#e74c3c" />
                <Text style={styles.errorText}>{errorMessage ?? t('BiometricErrorLockedOut')}</Text>
              </View>
            )}

            <View style={styles.buttonRow}>
              <View style={styles.retryBtn} testID="biometric-retry">
                <Text
                  style={[styles.retryText, { color: '#0f76a8' }]}
                  onPress={handleRetry}
                >
                  {t('BiometricUsePasscode')}
                </Text>
              </View>
            </View>

            <View style={styles.buttonRow}>
              <View style={styles.signOutBtn} testID="biometric-sign-out">
                <Text
                  style={styles.signOutText}
                  onPress={handleSignOut}
                >
                  {t('BiometricSignOut')}
                </Text>
              </View>
            </View>
          </GlassCard>
        )}
      </View>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 32,
    opacity: 0.7,
  },
  card: {
    width: '100%',
    padding: 20,
  },
  errorSection: {
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonRow: {
    marginTop: 10,
  },
  retryBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#0f76a840',
  },
  retryText: {
    fontSize: 15,
    fontWeight: '700',
  },
  signOutBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(231,76,60,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(231,76,60,0.28)',
  },
  signOutText: {
    color: '#e74c3c',
    fontWeight: '800',
    fontSize: 15,
  },
});
