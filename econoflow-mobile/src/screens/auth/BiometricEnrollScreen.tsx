import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootParamList } from '../../navigation/AppNavigator';
import { useBiometricStore } from '../../store/biometricStore';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

type Props = NativeStackScreenProps<RootParamList, 'BiometricEnroll'>;

export const BiometricEnrollScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { biometricPromptSkipped, setBiometricEnabled, setBiometricPromptSkipped } = useBiometricStore();
  const [checked, setChecked] = useState(false);

  const navigateToGate = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'BiometricGate' }] });
  }, [navigation]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (biometricPromptSkipped) {
        if (!cancelled) navigateToGate();
        return;
      }

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!cancelled) {
        if (!hasHardware || !isEnrolled) {
          navigateToGate();
        } else {
          setChecked(true);
        }
      }
    };

    run();

    return () => { cancelled = true; };
  }, [biometricPromptSkipped, navigateToGate]);

  const handleEnable = () => {
    setBiometricEnabled(true);
    navigateToGate();
  };

  const handleSkip = () => {
    setBiometricPromptSkipped();
    navigateToGate();
  };

  if (!checked) return null;

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
          {t('BiometricEnrollTitle')}
        </Text>
        <Text style={[styles.subtitle, { color: ink2 }]}>
          {t('BiometricEnrollMessage')}
        </Text>

        <GlassCard dark={dark} radius={20} style={styles.card}>
          <View style={styles.enableBtn} testID="biometric-enroll-enable">
            <Text
              style={styles.enableText}
              onPress={handleEnable}
            >
              {t('BiometricEnrollEnable')}
            </Text>
          </View>

          <View style={styles.skipRow}>
            <Text
              style={[styles.skipText, { color: ink2 }]}
              onPress={handleSkip}
              testID="biometric-enroll-skip"
            >
              {t('BiometricEnrollSkip')}
            </Text>
          </View>
        </GlassCard>
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
  enableBtn: {
    backgroundColor: '#0f76a8',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  enableText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  skipRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  skipText: {
    fontWeight: '600',
    fontSize: 13.5,
    paddingVertical: 8,
  },
});
