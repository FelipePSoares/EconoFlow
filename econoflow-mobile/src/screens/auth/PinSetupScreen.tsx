import React, { useState, useCallback, useRef, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SessionParamList } from '../../navigation/SessionNavigator';
import { PIN_LENGTH_MAX, PIN_LENGTH_MIN, usePinStore } from '../../store/pinStore';
import { hydrateBiometricStore, useBiometricStore } from '../../store/biometricStore';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { trace } from '../../diagnostics/trace';
import { attachNavigationListeners, useScreenTrace } from '../../diagnostics/useScreenTrace';

type Props = NativeStackScreenProps<SessionParamList, 'PinSetup'>;

const PinDots: React.FC<{ length: number; max: number }> = ({ length, max }) => (
  <View style={styles.dotsRow}>
    {Array.from({ length: max }, (_, i) => (
      <View key={i} style={[styles.dot, i < length ? styles.dotFilled : styles.dotEmpty]} />
    ))}
  </View>
);

const KeyPad: React.FC<{ onDigit: (d: string) => void; onBackspace: () => void }> = ({ onDigit, onBackspace }) => {
  const renderKey = (digit: string) => (
    <TouchableOpacity key={digit} style={styles.key} onPress={() => onDigit(digit)} activeOpacity={0.6} testID={`pin-key-${digit}`}>
      <Text style={styles.keyText}>{digit}</Text>
    </TouchableOpacity>
  );
  return (
    <View style={styles.keypad}>
      <View style={styles.keypadRow}>{renderKey('1')}{renderKey('2')}{renderKey('3')}</View>
      <View style={styles.keypadRow}>{renderKey('4')}{renderKey('5')}{renderKey('6')}</View>
      <View style={styles.keypadRow}>{renderKey('7')}{renderKey('8')}{renderKey('9')}</View>
      <View style={styles.keypadRow}>
        <View style={styles.key} />
        {renderKey('0')}
        <TouchableOpacity style={styles.key} onPress={onBackspace} activeOpacity={0.6} testID="pin-key-backspace">
          <MaterialCommunityIcons name="backspace-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const PinSetupScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { setPin } = usePinStore();
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [display, setDisplay] = useState('');
  const [error, setError] = useState<string | null>(null);
  // The chosen PIN while confirming. State, not a ref: the confirmation screen renders its
  // dot count from it, and a ref read during render is not tracked by the compiler.
  const [savedPin, setSavedPin] = useState('');
  const stepRef = useRef(step);
  const createBufRef = useRef('');
  const confirmBufRef = useRef('');
  // Whether this screen is still the one in front: the save path navigates from an awaited
  // promise, and a screen that left while the write was in flight must not move the stack
  // (the trail records this, see `useScreenTrace`).
  const onScreenRef = useScreenTrace('PinSetup');
  useEffect(() => attachNavigationListeners(navigation, 'PinSetup', onScreenRef), [navigation, onScreenRef]);

  useEffect(() => { stepRef.current = step; }, [step]);

  // The saving path waits for the answer it is about to act on, and nothing is decided
  // anywhere else: the screen simply stays up until the read lands (#1116).
  const pendingSaves = useRef(0);

  /**
   * Records the PIN, then continues to the unlock flow.
   *
   * **The navigation comes first, and it does not wait for anything** (#1116).
   *
   * It used to be dispatched after `await setPin(pin)` and `await hydrateBiometricStore()` —
   * and by then the `navigation` object this screen captured could belong to a stack that had
   * already been replaced, so React Navigation logged "The action 'RESET' …
   * {"name":"PinSetup"} … was not handled by any navigator" and the customer was left on a
   * blank screen until the app was restarted. That is the reported defect, and it only
   * happens on the slow reads a real device has and a test double does not.
   *
   * So the order is: save the PIN (state), move the stack (synchronously, while this screen is
   * certainly mounted), then read the stored biometric answer in the background and use it
   * only to decide *where the next screen goes* — never whether this navigation happens.
   */
  const finish = useCallback((pin: string) => {
    trace('pinsetup.finish.start', { onScreen: onScreenRef.current });

    // 1. The PIN itself. `setPin` hashes asynchronously but writes the store last; the
    //    screen leaves either way, because the value the next screen needs is `hasPin`.
    void setPin(pin).catch(() => undefined);

    // 2. Move the stack now. `replace`, not `reset`: this screen was the session's entry, and
    //    nothing may be left behind that a back gesture could return to.
    //
    //    Where it goes is decided by the answer *already in the store*: a decline is
    //    persisted, so after one the offer must not be shown again (#1052). The read that
    //    makes sure it is loaded is started below, not awaited here.
    const { biometricPromptSkipped } = useBiometricStore.getState();
    const target = biometricPromptSkipped ? 'BiometricGate' : 'BiometricEnroll';
    try {
      trace('pinsetup.navigate.dispatch', { target, onScreen: onScreenRef.current });
      navigation.replace(target);
    } catch (error) {
      trace('pinsetup.navigate.threw', {
        target,
        error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      });
    }

    // 3. The offer's own screen waits for the stored answer before it offers anything, so the
    //    read only has to be *started* here — joining the one the session already ran.
    void hydrateBiometricStore();
  }, [setPin, navigation, onScreenRef]);

  const finishRef = useRef(finish);
  useEffect(() => { finishRef.current = finish; }, [finish]);

  /** The create step is done: the user picked a 4–6 digit PIN and confirmed the length. */
  const handleContinue = () => {
    const pin = createBufRef.current;
    if (pin.length < PIN_LENGTH_MIN) return;
    setSavedPin(pin);
    createBufRef.current = '';
    confirmBufRef.current = '';
    setDisplay('');
    setError(null);
    setStep('confirm');
  };

  const handleMismatch = useCallback(() => {
    setError(t('PinMismatch'));
    confirmBufRef.current = '';
    setSavedPin('');
    createBufRef.current = '';
    setDisplay('');
    setStep('create');
  }, [t]);

  const handleDigit = useCallback((digit: string) => {
    setError(null);
    if (stepRef.current === 'create') {
      // Nothing moves on by itself: a PIN may be 4, 5 or 6 digits, so only the user can
      // say it is complete (#1052). It used to jump to confirmation at the fourth digit,
      // which made a longer PIN impossible to enter.
      if (createBufRef.current.length >= PIN_LENGTH_MAX) return;
      createBufRef.current += digit;
      setDisplay(createBufRef.current);
    } else {
      if (confirmBufRef.current.length >= savedPin.length) return;
      confirmBufRef.current += digit;
      setDisplay(confirmBufRef.current);
      // Confirmed as soon as the same number of digits is typed again — four for a
      // four-digit PIN, six for a six-digit one. Waiting for a fixed length is why a
      // correct 4-digit confirmation never continued.
      if (confirmBufRef.current.length === savedPin.length) {
        const confirmed = confirmBufRef.current === savedPin;
        // The buffer is cleared either way: the step is about to leave this state.
        confirmBufRef.current = '';
        if (confirmed) {
          // One save per tap: typing fast around the confirmation must not save twice.
          if (pendingSaves.current > 0) return;
          pendingSaves.current += 1;
          // `finish` is synchronous now — it moves the stack before anything is awaited, so
          // the navigation cannot be lost to a screen that unmounted while a read ran.
          // The guard is released on the next task, after the screen has gone.
          finishRef.current(savedPin);
          setTimeout(() => {
            pendingSaves.current = Math.max(0, pendingSaves.current - 1);
          }, 0);
        } else {
          handleMismatch();
        }
      }
    }
  }, [handleMismatch, savedPin]);

  const handleBackspace = useCallback(() => {
    setError(null);
    if (stepRef.current === 'create') {
      createBufRef.current = createBufRef.current.slice(0, -1);
      setDisplay(createBufRef.current);
    } else {
      confirmBufRef.current = confirmBufRef.current.slice(0, -1);
      setDisplay(confirmBufRef.current);
    }
  }, []);

  return (
    <GlassScreen dark={dark}>
      <View style={styles.container}>
        <LinearGradient colors={['#0f76a8', '#14c08a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconWrap}>
          <MaterialCommunityIcons name="lock-outline" size={48} color="#fff" />
        </LinearGradient>
        <Text style={[styles.title, { color: ink }]}>
          {step === 'create' ? t('PinCreateTitle') : t('PinConfirmTitle')}
        </Text>
        <Text style={[styles.subtitle, { color: ink2 }]}>
          {step === 'create' ? t('PinCreateSubtitle') : ''}
        </Text>
        {/* The dots follow the length being typed, so a 4- or 5-digit PIN reads as
            complete rather than as a row with missing dots. */}
        <PinDots
          length={display.length}
          max={step === 'create'
            ? Math.max(PIN_LENGTH_MIN, display.length)
            : savedPin.length || PIN_LENGTH_MAX}
        />
        {error && (
          <GlassCard dark={dark} radius={14} style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </GlassCard>
        )}
        <KeyPad onDigit={handleDigit} onBackspace={handleBackspace} />
        {step === 'create' && (
          <View style={styles.continueRow}>
            <AuroraPrimaryButton
              testID="pin-create-continue"
              label={t('PinContinue')}
              onPress={handleContinue}
              disabled={display.length < PIN_LENGTH_MIN}
            />
          </View>
        )}
      </View>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconWrap: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center', marginBottom: 32, opacity: 0.7 },
  dotsRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotFilled: { backgroundColor: '#0f76a8' },
  dotEmpty: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  continueRow: { width: '100%', maxWidth: 280 },
  errorCard: { width: '100%', padding: 12, marginBottom: 16 },
  errorText: { color: '#e74c3c', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  keypad: { width: '100%', maxWidth: 280, gap: 12 },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 12 },
  key: { width: 72, height: 56, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  keyText: { color: '#fff', fontSize: 22, fontWeight: '700' },
});




