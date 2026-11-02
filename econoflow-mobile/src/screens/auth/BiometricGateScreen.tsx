import React, { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text, ActivityIndicator } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SessionParamList } from '../../navigation/SessionNavigator';
import { useAuthStore } from '../../store/authStore';
import {
  hydrateBiometricStore,
  isBiometricAnswerKnown,
  subscribeBiometricAnswering,
} from '../../store/biometricStore';
import {
  hydratePinStore,
  isPinAnswerKnown,
  subscribePinAnswering,
  usePinStore,
} from '../../store/pinStore';
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
 *
 * **This screen never redirects on mount** (#1116). It is only ever the session's first
 * screen when the device stores a PIN *and* has biometrics on — `SessionNavigator` picks it
 * with `initialRouteName`, from the same store values — so there is nothing to redirect to.
 * Moving away from the gate is always something the customer did: answered the sensor, or
 * used the PIN the gate offers once the sensor gave up.
 */
export const BiometricGateScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { clearAuth, needsOnboarding } = useAuthStore();
  const { hasPin } = usePinStore();
  const { setUnlocked } = useLockStore();

  // ── What the device stores is what decides (#1116) ──────────────────────────
  //
  // Both values below are defaults until their read lands, and a default is not an
  // answer: "no PIN, biometrics off" sent a returning customer to create a second PIN
  // right after logging in, and then to the keypad on the next launch. The reads are
  // *subscribed to*, not sampled — a login re-reads both stores, and the gate mounts over
  // that read, so the screen has to re-render when it lands as well as when the next one
  // starts.
  const pinKnown = useSyncExternalStore(subscribePinAnswering, isPinAnswerKnown);
  const biometricKnown = useSyncExternalStore(subscribeBiometricAnswering, isBiometricAnswerKnown);

  useEffect(() => {
    // The gate is the first screen of a session and cannot rely on whoever created it to
    // have started the reads (a token restored by the client, a session in the same app
    // run). Both calls join a read already in flight.
    void hydratePinStore();
    void hydrateBiometricStore();
  }, []);

  const enterApp = useCallback(() => {
    setUnlocked();
    const target = needsOnboarding ? 'Onboarding' : 'Main';
    navigation.reset({ index: 0, routes: [{ name: target }] });
  }, [setUnlocked, needsOnboarding, navigation]);

  // `autoPrompt: false`: the prompt is owned by the effect below, which first decides
  // whether this device can use biometrics at all. Letting the hook fire would show a
  // system dialog on a device with no PIN, no sensor or biometrics switched off.
  const unlock = useBiometricUnlock(enterApp, { escapeAvailable: false, autoPrompt: false });

  const promptedOnce = useRef(false);

  const answersKnown = pinKnown && biometricKnown;

  // The sensor gave up (or this device has no usable one), or there is no PIN to fall back
  // to at all: the PIN takes over. This is a *response* — to the sensor failing, or to the
  // PIN missing — never a decision taken at mount: which screen opens a session is chosen by
  // `SessionNavigator`, before this one mounts (#1116).
  const pinIsTheWay = answersKnown && (!hasPin || unlock.unavailable || unlock.exhausted);

  // Idempotent: the effect can run once per failing attempt before the screen is replaced.
  const pinRequestedRef = useRef(false);
  useEffect(() => {
    if (!pinIsTheWay || pinRequestedRef.current) return;
    pinRequestedRef.current = true;
    const target = hasPin ? 'PinEntry' : 'PinSetup';

    // **Never hand over to the route this screen is not part of owning** (#1116).
    //
    // The action is a `reset` on the session stack, and it is dispatched from an effect. In a
    // session that opened on `PinSetup` (a device with no PIN), the stack has already been
    // replaced by the time this runs — React Navigation then drops it with "The action
    // 'RESET' … {"name":"PinSetup"} … was not handled by any navigator", and what the customer
    // sees is a blank screen until the app is restarted.
    //
    // Guarding is better than reordering: the navigator this screen captured may no longer
    // own the state, so the only safe move is to make one only while it demonstrably does.
    if (!navigation.isFocused()) return;
    navigation.replace(target);
    // `pinIsTheWay` already folds the sensor's state in, and is the only input that matters:
    // reading `unlock` here would re-run the handover for every render of the hook.
  }, [pinIsTheWay, hasPin, navigation]);

  // The sensor is asked as soon as the screen is in front — once, and only while it is the
  // way in. Read through a ref: the hook object is rebuilt on every render, and a prompt
  // effect keyed on it opened the sensor twice on one mount.
  const unlockRef = useRef(unlock);
  useEffect(() => {
    unlockRef.current = unlock;
  }, [unlock]);

  useEffect(() => {
    if (!answersKnown || pinIsTheWay) return;
    if (!promptedOnce.current) {
      promptedOnce.current = true;
      void unlockRef.current.prompt();
    }
  }, [answersKnown, pinIsTheWay]);

  const handleSignOut = () => {
    // No navigation call: `AppGate` renders the auth tree as soon as the store says the
    // session is gone, and `Auth` is not a route on the session navigator.
    clearAuth();
  };

  // A read still on its way holds the screen: deciding before it lands is the bug this
  // screen exists to avoid (#1116). The read always settles — a failed one counts as an
  // answer — so this cannot wait forever.
  if (!answersKnown) return null;

  // The PIN fallback took over: this screen is on its way out and must not flash behind it.
  if (pinIsTheWay) return null;

  // Nothing to show until the sensor answers once: the prompt is being opened.
  if (unlock.failures === 0 && !unlock.prompting) {
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
                onPress={() => navigation.replace('PinEntry')}
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



