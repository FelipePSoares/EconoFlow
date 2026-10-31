import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SessionParamList } from '../../navigation/SessionNavigator';
import { useBiometricStore } from '../../store/biometricStore';
import { hydratePinStore, usePinStore } from '../../store/pinStore';
import { useLockStore } from '../../store/lockStore';
import { useAuthStore } from '../../store/authStore';
import { useBiometricToggle } from '../../hooks/useBiometricToggle';
import type { BiometricFailure } from '../../hooks/useBiometricToggle';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { useAppTheme } from '../../theme/useAppTheme';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

type Props = NativeStackScreenProps<SessionParamList, 'BiometricEnroll'>;

export const BiometricEnrollScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { colors, customColors } = useAppTheme();
  const { biometricPromptSkipped, setBiometricPromptSkipped } = useBiometricStore();
  const { hasPin } = usePinStore();
  const { setUnlocked } = useLockStore();
  const { needsOnboarding } = useAuthStore();

  /** The PIN path satisfied the lock: continue into the app without asking again. */
  const unlockAndEnter = useCallback(() => {
    setUnlocked();
    navigation.reset({
      index: 0,
      routes: [{ name: needsOnboarding ? 'Onboarding' : 'Main' }],
    });
  }, [setUnlocked, needsOnboarding, navigation]);
  // The hook, not the store, is what checks the device before persisting the choice.
  const { setBiometricEnabled: enableBiometric } = useBiometricToggle();
  const [checked, setChecked] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);
  const [errorReason, setErrorReason] = useState<BiometricFailure | null>(null);

  /** Enabled: retry the unlock, which now has a working shortcut. */
  const navigateToGate = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'BiometricGate' }] });
  }, [navigation]);

  /** Everything that ends this offer as "not enabled" continues on the PIN side (#1052). */
  const navigateToPin = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: hasPin ? 'PinEntry' : 'PinSetup' }] });
  }, [hasPin, navigation]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      // The gate decides from `hasPin`, so the read must be there before it is used — this
      // screen is also reachable on a path that never touched the gate's await.
      await hydratePinStore();

      if (biometricPromptSkipped) {
        if (!cancelled) navigateToPin();
        return;
      }

      // A rejected native call used to leave the screen blank forever, because nothing
      // else could move the user on from `checked === false`.
      let hasHardware = false;
      let isEnrolled = false;
      try {
        hasHardware = await LocalAuthentication.hasHardwareAsync();
        isEnrolled = hasHardware && await LocalAuthentication.isEnrolledAsync();
      } catch {
        hasHardware = false;
        isEnrolled = false;
      }

      if (!cancelled) {
        if (!hasHardware || !isEnrolled) {
          // Nothing to offer on this device: continue to the PIN the app requires.
          navigateToPin();
        } else {
          setChecked(true);
        }
      }
    };

    run();

    return () => { cancelled = true; };
  }, [biometricPromptSkipped, navigateToPin]);

  const handleEnable = async () => {
    if (isEnabling) return;
    setIsEnabling(true);
    setErrorReason(null);
    // The hook re-checks the device before persisting, so the setting cannot be stored on
    // a device that lost its enrolment between this screen's check and the tap.
    const result = await enableBiometric(true);
    setIsEnabling(false);
    if (result.ok) {
      navigateToGate();
      return;
    }
    setErrorReason(result.reason);
  };

  const handleSkip = () => {
    // The offer is recorded as declined before anything else, so it never comes back on a
    // later launch. Biometrics can still be enabled from the settings at any time (#1052).
    setBiometricPromptSkipped();
    // A user who already has a PIN — the setup flow hands them here right after confirming
    // one — continues straight into the app: asking for the PIN again only to unlock an
    // optional shortcut adds nothing.
    if (hasPin) {
      unlockAndEnter();
      return;
    }
    navigateToPin();
  };

  const errorMessage = (() => {
    switch (errorReason) {
      case 'hardware':
        return t('BiometricNotAvailable');
      case 'not-enrolled':
        return t('BiometricErrorNotEnrolled');
      case 'not-hydrated':
      case 'unknown':
        return t('BiometricEnableFailed');
      default:
        return undefined;
    }
  })();

  if (!checked) return null;

  return (
    <GlassScreen dark={dark}>
      <View style={styles.container}>
        <LinearGradient
          colors={[colors.primary, customColors.accentGreen]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconWrap}
        >
          <MaterialCommunityIcons name="fingerprint" size={48} color={colors.onPrimary} />
        </LinearGradient>

        <Text style={[styles.title, { color: ink }]}>
          {t('BiometricEnrollTitle')}
        </Text>
        <Text style={[styles.subtitle, { color: ink2 }]}>
          {t('BiometricEnrollMessage')}
        </Text>

        <ErrorBanner
          visible={!!errorMessage}
          message={errorMessage}
          onDismiss={() => setErrorReason(null)}
        />

        <GlassCard dark={dark} radius={20} style={styles.card}>
          {/* The whole button is the touch target: the label alone left the padded area
              dead, so a tap on it looked like it had done nothing (#1052). */}
          <Pressable
            onPress={handleEnable}
            disabled={isEnabling}
            accessibilityRole="button"
            accessibilityLabel={t('BiometricEnrollEnable')}
            accessibilityState={{ disabled: isEnabling, busy: isEnabling }}
            style={({ pressed }) => [
              styles.enableBtn,
              { backgroundColor: colors.primary, opacity: isEnabling ? 0.6 : pressed ? 0.85 : 1 },
            ]}
            testID="biometric-enroll-enable"
          >
            <Text style={[styles.enableText, { color: colors.onPrimary }]}>
              {t('BiometricEnrollEnable')}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSkip}
            accessibilityRole="button"
            accessibilityLabel={t('BiometricEnrollSkip')}
            style={styles.skipRow}
            testID="biometric-enroll-skip"
          >
            <Text style={[styles.skipText, { color: ink2 }]}>
              {t('BiometricEnrollSkip')}
            </Text>
          </Pressable>
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
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  enableText: {
    fontWeight: '800',
    fontSize: 15,
  },
  skipRow: {
    alignItems: 'center',
    marginTop: 16,
    paddingVertical: 8,
  },
  skipText: {
    fontWeight: '600',
    fontSize: 13.5,
  },
});
