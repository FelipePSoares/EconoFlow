import React, { useEffect, useState, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { useBiometricStore } from '../../store/biometricStore';
import { usePinStore } from '../../store/pinStore';
import { useLockStore } from '../../store/lockStore';
import { useAuthStore } from '../../store/authStore';
import { GlassScreen } from './GlassScreen';
import { GlassCard } from './GlassCard';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

const PIN_LENGTH_MAX = 6;
const MAX_ATTEMPTS = 5;
const MAX_BIOMETRIC_FAILURES = 3;

/**
 * Outcomes of `authenticateAsync` that end the prompt without the customer answering it.
 *
 * The sensor was never read, so nothing was proved against the customer: the app keeps the
 * lock (it is what dismissed the prompt) and asks again when it is back in front. A real
 * refusal (`authentication_failed`, `lockout`) still counts, and enough of them hand the
 * lock to the keypad.
 */
const COMPLETED_WITHOUT_ANSWER: ReadonlySet<string> = new Set([
  'system_cancel',
  'app_cancel',
  'user_cancel',
  'user_fallback',
]);

/**
 * `styles` is a `const` declared at the bottom of this module. `PinDots` and `KeyPad` are
 * defined above it but only run while rendering, which is after module evaluation — so
 * they may reference it safely. Anything that runs **during** evaluation (a component
 * created eagerly, for example) must not.
 */

const PinDots: React.FC<{ length: number; max: number }> = ({ length, max }) => (
  <View style={styles.dotsRow}>
    {Array.from({ length: max }, (_, i) => (
      <View
        key={i}
        style={[styles.dot, i < length ? styles.dotFilled : styles.dotEmpty]}
      />
    ))}
  </View>
);

const KeyPad: React.FC<{
  onDigit: (d: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}> = ({ onDigit, onBackspace, disabled }) => {
  const renderKey = (digit: string) => (
    <TouchableOpacity
      key={digit}
      style={styles.key}
      onPress={() => onDigit(digit)}
      disabled={disabled}
      activeOpacity={0.6}
      testID={`pin-key-${digit}`}
    >
      <Text style={styles.keyText}>{digit}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.keypad}>
      <View style={styles.keypadRow}>
        {renderKey('1')}{renderKey('2')}{renderKey('3')}
      </View>
      <View style={styles.keypadRow}>
        {renderKey('4')}{renderKey('5')}{renderKey('6')}
      </View>
      <View style={styles.keypadRow}>
        {renderKey('7')}{renderKey('8')}{renderKey('9')}
      </View>
      <View style={styles.keypadRow}>
        <View style={styles.key} />
        {renderKey('0')}
        <TouchableOpacity
          style={styles.key}
          onPress={onBackspace}
          disabled={disabled}
          activeOpacity={0.6}
        >
          <MaterialCommunityIcons name="backspace-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const LockOverlay: React.FC = () => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { biometricEnabled } = useBiometricStore();
  const { hasPin, verifyPin, clearPin } = usePinStore();
  const { setUnlocked } = useLockStore();
  const { clearAuth, isAuthenticated } = useAuthStore();
  const { clearBiometric } = useBiometricStore();

  const [mode, setMode] = useState<'biometric' | 'pin'>(
    !biometricEnabled || !hasPin ? 'pin' : 'biometric'
  );
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [biometricAttempts, setBiometricAttempts] = useState(0);
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  // The foreground state this overlay last saw, so only a background → active transition
  // re-opens the prompt (not every AppState event, e.g. Android's `blur`/`focus`).
  const appStateRef = useRef<AppStateStatus>((AppState.currentState ?? 'active') as AppStateStatus);

  const handleForgotPin = useCallback(() => {
    clearBiometric();
    clearPin();
    clearAuth();
  }, [clearBiometric, clearPin, clearAuth]);

  /**
   * One sensor attempt. The dialogs are opened in order, never together, and the keypad
   * only appears once the attempts are used up (#1052).
   */
  const attemptBiometric = useCallback(async (): Promise<void> => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      // The two native checks get their own guard: a module that cannot answer is the same
      // outcome for the user as "no sensor on this device", and must land on the PIN.
      let canPrompt = false;
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        canPrompt = hasHardware && await LocalAuthentication.isEnrolledAsync();
      } catch {
        canPrompt = false;
      }
      if (!mountedRef.current) return;

      if (!canPrompt) {
        // No sensor to use: the PIN is the lock by itself, no attempt spent.
        setBiometricAttempts(MAX_BIOMETRIC_FAILURES);
        setMode('pin');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('BiometricPromptReason'),
        cancelLabel: t('ButtonCancel'),
        disableDeviceFallback: false,
      });
      if (!mountedRef.current) return;

      if (result.success) {
        setUnlocked();
        return;
      }

      // A prompt the system cancelled *for* the customer — the app went to the background
      // while it was up, or a system screen covered it — is not a failed attempt: the app is
      // still locked, and spending one of the three attempts would push a quick switch-back
      // onto the keypad. Coming back to the foreground asks again instead.
      if (COMPLETED_WITHOUT_ANSWER.has(result.error ?? '')) return;

      setBiometricAttempts((previous) => previous + 1);
      setMode('pin');
    } catch {
      if (mountedRef.current) setBiometricAttempts((previous) => previous + 1);
    } finally {
      inFlightRef.current = false;
    }
  }, [setUnlocked, t]);

  // The sensor prompt is an external side effect, so it is opened on a task rather than
  // synchronously in the effect body.
  //
  // The dependencies are the lock's *inputs* only. A failure must not re-arm the effect: it
  // would open a new prompt for every attempt and loop the sensor without the customer asking
  // (#1052). Only a return to the foreground re-asks, and the attempts counter is read through
  // a ref so the listener always sees its current value.
  const attemptsRef = useRef(biometricAttempts);
  useEffect(() => {
    attemptsRef.current = biometricAttempts;
  }, [biometricAttempts]);

  useEffect(() => {
    // Signed out: nothing to unlock, and no dialog over the Login screen.
    if (!isAuthenticated) return;
    if (!biometricEnabled || !hasPin) return;

    const prompt = () => {
      // Never a second prompt on top of one the customer has not answered yet: the OS would
      // stack the dialogs and the second would be answered by the first dismissal.
      if (inFlightRef.current) return;
      // The keypad owns the lock once the sensor ran out of attempts; it offers the way back.
      if (attemptsRef.current >= MAX_BIOMETRIC_FAILURES) return;
      void attemptBiometric();
    };

    const task = setTimeout(prompt, 0);

    // Coming back to the app asks again, without waiting for a tap: the overlay stays mounted
    // for as long as the app is locked, so this is the case a restart never reaches.
    const subscription = AppState.addEventListener('change', (next) => {
      const wasAway = appStateRef.current !== 'active';
      appStateRef.current = next;
      if (wasAway && next === 'active') prompt();
    });

    return () => {
      clearTimeout(task);
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, biometricEnabled, hasPin]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      try {
        void LocalAuthentication.cancelAuthenticate?.()?.catch(() => undefined);
      } catch {
        // Best effort: nothing to clean up if the module cannot cancel.
      }
    };
  }, []);

  const handleDigit = useCallback(async (digit: string) => {
    setError(null);
    setPinValue((prev) => {
      if (prev.length >= PIN_LENGTH_MAX) return prev;
      const next = prev + digit;
      if (next.length >= 4) {
        setTimeout(async () => {
          const ok = await verifyPin(next);
          if (ok) {
            setUnlocked();
          } else {
            const newAttempts = attempts + 1;
            setAttempts(newAttempts);
            if (newAttempts >= MAX_ATTEMPTS) {
              setError(t('PinMaxAttempts'));
              setTimeout(() => handleForgotPin(), 2000);
            } else {
              setError(t('PinAttemptsRemaining', { count: MAX_ATTEMPTS - newAttempts }));
            }
            setPinValue('');
          }
        }, 200);
      }
      return next;
    });
  }, [verifyPin, setUnlocked, attempts, t, handleForgotPin]);

  const handleBackspace = useCallback(() => {
    setError(null);
    setPinValue((prev) => prev.slice(0, -1));
  }, []);

  const remaining = MAX_ATTEMPTS - attempts;

  // #1052: the sensor is the only way in while it has attempts left. The keypad is the
  // fallback, so it must not sit underneath the fingerprint dialog asking for both at
  // once: it is shown once the sensor failed `MAX_BIOMETRIC_FAILURES` times, or right away
  // when there is no sensor to use.
  const sensorAvailable = biometricEnabled && hasPin;
  const showKeypad = !sensorAvailable || biometricAttempts >= MAX_BIOMETRIC_FAILURES;
  // The retry panel belongs to the sensor, so it is shown while the prompt is in use — the
  // keypad, and with it the way back to the sensor, appears only once attempts run out.
  const biometricInUse = showKeypad && sensorAvailable;
  const showBiometricPanel = sensorAvailable && biometricAttempts < MAX_BIOMETRIC_FAILURES;

  // There is nothing to unlock while signed out — and nothing may cover the Login screen:
  // the lock store starts locked by design (so a relaunch cannot walk past the gate), and
  // this overlay is rendered for the whole app, so without this a fresh start showed a PIN
  // pad before anyone had signed in (#1052).
  if (!isAuthenticated) return null;

  return (
    <View style={StyleSheet.absoluteFill} testID="lock-overlay">
      <GlassScreen dark={dark}>
        <View style={styles.container}>
          <LinearGradient
            colors={['#0f76a8', '#14c08a']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconWrap}
          >
            <MaterialCommunityIcons
              name={mode === 'biometric' ? 'fingerprint' : 'lock-outline'}
              size={48}
              color="#fff"
            />
          </LinearGradient>

          <Text style={[styles.title, { color: ink }]}>
            {mode === 'biometric' ? t('BiometricGateTitle') : t('PinEntryTitle')}
          </Text>
          <Text style={[styles.subtitle, { color: ink2 }]}>
            {mode === 'biometric' ? t('BiometricGateSubtitle') : t('PinEntrySubtitle')}
          </Text>

          {showKeypad && (
            <>
              <View testID="pin-keypad">
                <KeyPad onDigit={handleDigit} onBackspace={handleBackspace} />
              </View>

              <PinDots length={pin.length} max={PIN_LENGTH_MAX} />

              {error && (
                <GlassCard dark={dark} radius={14} style={styles.errorCard}>
                  <Text style={styles.errorText}>{error}</Text>
                </GlassCard>
              )}

              {remaining < MAX_ATTEMPTS && remaining > 0 && (
                <Text style={[styles.attemptsText, { color: ink2 }]}>
                  {t('PinAttemptsRemaining', { count: remaining })}
                </Text>
              )}

              {biometricInUse && (
                <TouchableOpacity
                  onPress={() => { void attemptBiometric(); }}
                  activeOpacity={0.7}
                  style={styles.biometricRow}
                  testID="lock-use-biometric"
                >
                  <MaterialCommunityIcons name="fingerprint" size={22} color={ink2} />
                  <Text style={[styles.biometricText, { color: ink2 }]}>{t('BiometricUseInstead')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                onPress={handleForgotPin}
                activeOpacity={0.7}
                style={styles.forgotRow}
              >
                <Text style={[styles.forgotText, { color: ink2 }]}>
                  {t('PinForgot')}
                </Text>
              </TouchableOpacity>
            </>
          )}

          {showBiometricPanel && (
            <GlassCard dark={dark} radius={20} style={styles.card}>
              <View style={styles.buttonRow}>
                <View style={styles.retryBtn}>
                  <Text
                    style={[styles.retryText, { color: '#0f76a8' }]}
                    onPress={() => { void attemptBiometric(); }}
                  >
                    {t('BiometricUsePasscode')}
                  </Text>
                </View>
              </View>
            </GlassCard>
          )}
        </View>
      </GlassScreen>
    </View>
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
  dotsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dotFilled: {
    backgroundColor: '#0f76a8',
  },
  dotEmpty: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  errorCard: {
    width: '100%',
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#e74c3c',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  attemptsText: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  card: {
    width: '100%',
    padding: 20,
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
  keypad: {
    width: '100%',
    maxWidth: 280,
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 12,
  },
  key: {
    width: 72,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
  },
  biometricRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingVertical: 8 },
  biometricText: { fontSize: 14, fontWeight: '600' },
  forgotRow: {
    marginTop: 24,
    paddingVertical: 8,
  },
  forgotText: {
    fontSize: 14,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
});
