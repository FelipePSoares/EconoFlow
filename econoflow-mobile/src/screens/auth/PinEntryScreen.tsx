import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { SessionParamList } from '../../navigation/SessionNavigator';
import { PIN_LENGTH_MAX, PIN_LENGTH_MIN, usePinStore } from '../../store/pinStore';
import { useBiometricUnlock } from '../../hooks/useBiometricUnlock';
import { useLockStore } from '../../store/lockStore';
import { useAuthStore } from '../../store/authStore';
import { useBiometricStore } from '../../store/biometricStore';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

type Props = NativeStackScreenProps<SessionParamList, 'PinEntry'>;

const MAX_ATTEMPTS = 5;

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

export const PinEntryScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { verifyPin, clearPin, pinLength } = usePinStore();
  const { setUnlocked } = useLockStore();
  const { clearAuth } = useAuthStore();
  const { clearBiometric, biometricEnabled } = useBiometricStore();
  const { needsOnboarding } = useAuthStore();
  const [display, setDisplay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [entering, setEntering] = useState(false);
  const bufRef = useRef('');
  const verifyingRef = useRef(false);

  const enterApp = useCallback(() => {
    setEntering(true);
    setUnlocked();
    navigation.reset({
      index: 0,
      routes: [{ name: needsOnboarding ? 'Onboarding' : 'Main' }],
    });
  }, [setUnlocked, needsOnboarding, navigation]);

  /**
   * The shared sensor prompt. It is **not** automatic here: this screen is already the
   * fallback, and prompting over the keypad would ask for both at once (#1052). The user
   * taps the fingerprint button to go back to the sensor.
   */
  const unlock = useBiometricUnlock(enterApp, { autoPrompt: false });

  const handleForgotPin = useCallback(() => {
    // Clearing the auth state is enough: `AppGate` swaps to the auth tree on its own.
    clearBiometric();
    clearPin();
    clearAuth();
  }, [clearBiometric, clearPin, clearAuth]);

  const handleDigit = useCallback(async (digit: string) => {
    if (verifyingRef.current) return;
    setError(null);
    bufRef.current += digit;
    // Never keep more digits than the longest PIN; a dangling extra one would then be
    // part of the next attempt.
    if (bufRef.current.length > PIN_LENGTH_MAX) {
      bufRef.current = bufRef.current.slice(0, PIN_LENGTH_MAX);
    }
    setDisplay(bufRef.current);
    // Verify as soon as the stored number of digits is typed (#1052) — a 4-digit PIN must
    // not wait for six. A PIN saved before its length was recorded has no target, so the
    // hash decides: a match continues at once, a miss keeps accepting digits up to 6.
    const knownLength = typeof pinLength === 'number';
    const reachedTarget = knownLength
      ? bufRef.current.length === pinLength
      : bufRef.current.length >= PIN_LENGTH_MIN;
    if (!reachedTarget) return;

    verifyingRef.current = true;
    const input = bufRef.current;
    const ok = await verifyPin(input);
    verifyingRef.current = false;

    if (ok) {
      bufRef.current = '';
      setDisplay('');
      enterApp();
      return;
    }

    if (!knownLength && input.length < PIN_LENGTH_MAX) {
      // Four or five digits that do not match prove nothing when the PIN may be longer:
      // keep the digits and wait for more instead of spending one of the five attempts.
      return;
    }

    setAttempts((prev) => {
      const next = prev + 1;
      if (next >= MAX_ATTEMPTS) {
        setError(t('PinMaxAttempts'));
        setTimeout(() => handleForgotPin(), 2000);
      } else {
        setError(t('PinAttemptsRemaining', { count: MAX_ATTEMPTS - next }));
      }
      return next;
    });
    bufRef.current = '';
    setDisplay('');
  }, [verifyPin, pinLength, enterApp, t, handleForgotPin]);

  const handleBackspace = useCallback(() => {
    setError(null);
    bufRef.current = bufRef.current.slice(0, -1);
    setDisplay(bufRef.current);
  }, []);

  const remaining = MAX_ATTEMPTS - attempts;

  return (
    <GlassScreen dark={dark}>
      <View style={styles.container}>
        <LinearGradient colors={['#0f76a8', '#14c08a']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.iconWrap}>
          <MaterialCommunityIcons name="lock-outline" size={48} color="#fff" />
        </LinearGradient>
        <Text style={[styles.title, { color: ink }]}>{t('PinEntryTitle')}</Text>
        <Text style={[styles.subtitle, { color: ink2 }]}>{t('PinEntrySubtitle')}</Text>
        <PinDots length={display.length} max={PIN_LENGTH_MAX} />
        {error && (
          <GlassCard dark={dark} radius={14} style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </GlassCard>
        )}
        {remaining < MAX_ATTEMPTS && remaining > 0 && (
          <Text style={[styles.attemptsText, { color: ink2 }]}>{t('PinAttemptsRemaining', { count: remaining })}</Text>
        )}
        <KeyPad onDigit={handleDigit} onBackspace={handleBackspace} />
        {/* Back to the sensor: it is why this screen is here, and a user whose fingerprint
            works again must not be stuck on the keypad (#1052). */}
        {biometricEnabled && !entering && (
          <TouchableOpacity
            onPress={() => { void unlock.retry(); }}
            activeOpacity={0.7}
            style={styles.biometricRow}
            testID="pin-use-biometric"
          >
            <MaterialCommunityIcons name="fingerprint" size={22} color={ink2} />
            <Text style={[styles.biometricText, { color: ink2 }]}>{t('BiometricUseInstead')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={handleForgotPin} activeOpacity={0.7} style={styles.forgotRow} testID="pin-forgot">
          <Text style={[styles.forgotText, { color: ink2 }]}>{t('PinForgot')}</Text>
        </TouchableOpacity>
      </View>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconWrap: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, fontWeight: '500', textAlign: 'center', marginBottom: 32, opacity: 0.7 },
  dotsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  dotFilled: { backgroundColor: '#0f76a8' },
  dotEmpty: { backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  errorCard: { width: '100%', padding: 12, marginBottom: 12 },
  errorText: { color: '#e74c3c', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  attemptsText: { fontSize: 12, fontWeight: '600', marginBottom: 16, textAlign: 'center', opacity: 0.7 },
  keypad: { width: '100%', maxWidth: 280, gap: 12 },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-around', gap: 12 },
  key: { width: 72, height: 56, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.10)', alignItems: 'center', justifyContent: 'center' },
  keyText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  biometricRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, paddingVertical: 8 },
  biometricText: { fontSize: 14, fontWeight: '600' },
  forgotRow: { marginTop: 24, paddingVertical: 8 },
  forgotText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
