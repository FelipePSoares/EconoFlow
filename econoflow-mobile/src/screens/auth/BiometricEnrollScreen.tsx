import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SessionParamList } from '../../navigation/SessionNavigator';
import {
  hydrateBiometricStore,
  isBiometricAnswerKnown,
  subscribeBiometricAnswering,
  useBiometricStore,
} from '../../store/biometricStore';
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
  // The decline is only an answer once the stored one has been read (#1116): a default
  // "not declined" while the read is in flight offers biometrics to a customer who already
  // said no, and that offer — after a login — is what the report described as the flow
  // starting on the wrong screen.
  const declinedKnown = useSyncExternalStore(subscribeBiometricAnswering, isBiometricAnswerKnown);
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
  // `null` while the device check runs — "we do not know yet" is not "cannot offer".
  const [deviceCanOffer, setDeviceCanOffer] = useState<boolean | null>(null);
  const [isEnabling, setIsEnabling] = useState(false);
  const [errorReason, setErrorReason] = useState<BiometricFailure | null>(null);

  /** Enabled: retry the unlock, which now has a working shortcut. */
  const navigateToGate = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'BiometricGate' }] });
  }, [navigation]);

  // There is deliberately no `navigateToPin` here. Every path that ends this offer as "not
  // enabled" navigates first and records the decline afterwards — see `handleSkip` and
  // `continueWithoutOffer` (#1116). A `reset` dispatched after a store write was the action
  // React Navigation dropped, because the write re-renders this screen.

  /**
   * The customer taps past an offer that cannot be made.
   *
   * With a PIN on the device the app is protected and they go straight in; without one the
   * PIN setup is the next step — the same rule `sessionEntryScreen` applies when a session
   * opens, so the two cannot disagree about where the customer belongs.
   */
  const continueWithoutOffer = useCallback(() => {
    if (hasPin) {
      unlockAndEnter();
      return;
    }
    navigation.replace('PinSetup');
  }, [hasPin, unlockAndEnter, navigation]);

  useEffect(() => {
    let cancelled = false;

    // Neither answer is known until its read lands; deciding on the defaults sends the
    // customer to the wrong screen (#1116). The reads are started here too (both calls
    // join one already in flight), so a path that reaches this screen alone still settles.
    if (!declinedKnown) void hydrateBiometricStore();

    const run = async () => {
      // The store's answer is what this screen offers on, so the read must be there first.
      await hydratePinStore();

      // A rejected native call used to leave the screen blank forever, because nothing
      // else could move the customer on from `checked === false`.
      let hasHardware = false;
      let isEnrolled = false;
      try {
        hasHardware = await LocalAuthentication.hasHardwareAsync();
        isEnrolled = hasHardware && await LocalAuthentication.isEnrolledAsync();
      } catch {
        hasHardware = false;
        isEnrolled = false;
      }

      if (!cancelled) setDeviceCanOffer(hasHardware && isEnrolled);
    };

    if (declinedKnown) run();

    return () => { cancelled = true; };
  }, [declinedKnown]);

  // ── A screen never redirects itself on mount (#1116) ──────────────────────────
  //
  // This screen is only ever *shown* by a customer who is here legitimately: the PIN setup
  // hands them over, or `BiometricEnroll` was popped back to. Offers that cannot be made —
  // the device cannot do biometrics, or the customer declined already — are rendered as
  // such, with the way forward on them, instead of a `reset` fired from an effect while the
  // stack is still mounting. That reset is what React Navigation drops, which is how a
  // successful login ended on a blank screen and needed an app restart.
  const cannotOffer = declinedKnown && (biometricPromptSkipped || deviceCanOffer === false);
  const ready = declinedKnown && deviceCanOffer === true && !biometricPromptSkipped;

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
    // **Navigate before writing to the store** (#1116).
    //
    // This used to record the decline first and navigate second. The write re-renders this
    // screen — and on a device the read behind it is slow — so by the time the `reset` was
    // dispatched the screen (and the stack it belonged to) had already been replaced, and
    // React Navigation dropped the action: "The action 'RESET' … {"name":"PinSetup"} … was
    // not handled by any navigator". What the customer saw was a blank screen and, after
    // restarting, the PIN setup — the reported defect.
    //
    // The decision is the same either way (it is read from the store's current state), so
    // the navigation can go first and the decline be recorded cost-free afterwards.
    const goesStraightIn = hasPin;

    if (goesStraightIn) {
      // The PIN was just confirmed; entering the app is what declining the optional shortcut
      // means. `replace`, not `reset`: this screen's stack is the one being replaced.
      unlockAndEnter();
    } else {
      // There is no PIN yet, so it comes before anything else — the rule
      // `sessionEntryScreen` applies when a session opens.
      navigation.replace('PinSetup');
    }

    // Recorded as declined either way, so the offer never comes back on a later launch
    // (#1052). Biometrics can still be enabled from the settings at any time.
    setBiometricPromptSkipped();
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

  // Neither answer is known yet: the screen paints, but offers nothing it cannot stand by.
  if (!ready && !cannotOffer) {
    return (
      <GlassScreen dark={dark}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </GlassScreen>
    );
  }

  // Nothing to offer here (no sensor, or declined already): the customer is told why and
  // moves on themselves — the PIN-side screen is reached by this button, not by a redirect.
  if (cannotOffer) {
    return (
      <GlassScreen dark={dark}>
        <View style={styles.container}>
          <LinearGradient
            colors={[colors.primary, customColors.accentGreen]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconWrap}
          >
            <MaterialCommunityIcons name="fingerprint-off" size={48} color={colors.onPrimary} />
          </LinearGradient>

          <Text style={[styles.title, { color: ink }]}>{t('BiometricEnrollTitle')}</Text>
          <Text style={[styles.subtitle, { color: ink2 }]}>{t('BiometricNotAvailable')}</Text>

          <GlassCard dark={dark} radius={20} style={styles.card}>
            <Pressable
              onPress={continueWithoutOffer}
              accessibilityRole="button"
              accessibilityLabel={t('BiometricSkipToPin')}
              style={({ pressed }) => [
                styles.enableBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
              testID="biometric-enroll-cannot-offer"
            >
              <Text style={[styles.enableText, { color: colors.onPrimary }]}>
                {t('BiometricSkipToPin')}
              </Text>
            </Pressable>
          </GlassCard>
        </View>
      </GlassScreen>
    );
  }

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
