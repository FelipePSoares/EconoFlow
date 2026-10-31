import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SessionParamList } from '../../navigation/SessionNavigator';
import { useAuthStore } from '../../store/authStore';
import { useBiometricStore } from '../../store/biometricStore';
import { usePinStore } from '../../store/pinStore';
import { useLockStore } from '../../store/lockStore';
import { useBiometricUnlock } from '../../hooks/useBiometricUnlock';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

type Props = NativeStackScreenProps<SessionParamList, 'BiometricGate'>;

/**
 * The unlock screen of a session (#1052).
 *
 * With biometrics on there is exactly one way in: the sensor. The PIN is the fallback, and
 * it is offered only after the sensor failed `MAX_BIOMETRIC_FAILURES` times (or is not
 * usable on this device) — never next to the prompt, which made the user answer twice.
 */
export const BiometricGateScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { clearAuth, needsOnboarding } = useAuthStore();
  const { biometricEnabled } = useBiometricStore();
  const { hasPin } = usePinStore();
  const { setUnlocked } = useLockStore();
  // The store reports hydration itself, and both `authStore` paths (relaunch and login)
  // start the read before this screen mounts. The *store's* flag is not the gate, though:
  // this screen must never refuse to render because of it — a session that arrives with the
  // flag still false would sit on the spinner forever, which is the blank screen the user
  // saw right after signing in (#1052).
  const storeHydrated = useBiometricStore((s) => s.hydrated);
  const persistHydrated = useBiometricStore.persist.hasHydrated();
  // `goToPin` may run more than once (a re-render before navigation settles); this keeps
  // the navigator from being reset onto the PIN screen again after the user acted.
  const pinRequestedRef = useRef(false);

  const enterApp = useCallback(() => {
    setUnlocked();
    navigation.reset({
      index: 0,
      routes: [{ name: needsOnboarding ? 'Onboarding' : 'Main' }],
    });
  }, [setUnlocked, needsOnboarding, navigation]);

  // `autoPrompt: false`: the prompt is owned by the effect below, which first decides
  // whether this device can use biometrics at all. Letting the hook fire would show a
  // system dialog on a device with no PIN, no sensor or biometrics switched off.
  const unlock = useBiometricUnlock(enterApp, { escapeAvailable: false, autoPrompt: false });

  /**
   * The PIN screen: create one if the user has none, otherwise enter it. Idempotent, so a
   * re-render cannot reset the navigator away from it.
   */
  const goToPin = useCallback(() => {
    if (pinRequestedRef.current) return;
    pinRequestedRef.current = true;
    navigation.reset({ index: 0, routes: [{ name: hasPin ? 'PinEntry' : 'PinSetup' }] });
  }, [hasPin, navigation]);

  const promptedOnce = useRef(false);

  // Without an app PIN there is nothing to unlock *to*: create it before any shortcut is
  // offered. When biometrics are off (never set up, declined, or unusable on this device)
  // the PIN is the whole lock. Out of sensor attempts, the PIN takes over on its own.
  const pinIsTheWay = !hasPin || !biometricEnabled || unlock.unavailable || unlock.exhausted;

  useEffect(() => {
    if (pinIsTheWay) {
      goToPin();
      return;
    }
    if (!promptedOnce.current) {
      promptedOnce.current = true;
      void unlock.prompt();
    }
  }, [pinIsTheWay, unlock, goToPin]);

  const handleSignOut = () => {
    // No navigation call: `AppGate` renders the auth tree as soon as the store says the
    // session is gone, and `Auth` is not a route on the session navigator.
    clearAuth();
  };

  // Only a *pending* store read holds the screen: the flag being false while the
  // persistence layer is already hydrated means this build never wrote it, and waiting
  // would be forever (#1052).
  if (!storeHydrated && !persistHydrated) return null;

  // The PIN fallback took over: this screen is on its way out and must not flash behind it.
  if (pinIsTheWay) return null;

  // Nothing to show until the sensor answers once: either the prompt is up, or the effect
  // above is about to send the user to the PIN.
  if (!pinIsTheWay && unlock.failures === 0 && !unlock.prompting) {
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

        <GlassCard dark={dark} radius={20} style={styles.card} testID="biometric-fallback">
          {unlock.lockedOut && (
            <View style={styles.errorSection} testID="biometric-lockout">
              <MaterialCommunityIcons name="lock-alert" size={32} color="#e74c3c" />
              <Text style={styles.errorText}>{t('BiometricErrorLockedOut')}</Text>
            </View>
          )}

          {/* Every row is a Pressable: the label alone was the only touch target, so a
              tap on the padding did nothing (#1052). */}
          {unlock.canUsePin && hasPin && (
            <View style={styles.buttonRow}>
              <Pressable
                style={styles.retryBtn}
                onPress={goToPin}
                accessibilityRole="button"
                accessibilityLabel={t('PinUseInstead')}
                testID="biometric-use-pin"
              >
                <Text style={[styles.retryText, { color: '#0f76a8' }]}>
                  {t('PinUseInstead')}
                </Text>
              </Pressable>
            </View>
          )}

          <View style={styles.buttonRow}>
            <Pressable
              style={styles.retryBtn}
              onPress={unlock.retry}
              accessibilityRole="button"
              accessibilityLabel={t('BiometricUsePasscode')}
              testID="biometric-retry"
            >
              <Text style={[styles.retryText, { color: '#0f76a8' }]}>
                {t('BiometricUsePasscode')}
              </Text>
            </Pressable>
          </View>

          <View style={styles.buttonRow}>
            <Pressable
              style={styles.signOutBtn}
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel={t('BiometricSignOut')}
              testID="biometric-sign-out"
            >
              <Text style={styles.signOutText}>
                {t('BiometricSignOut')}
              </Text>
            </Pressable>
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
