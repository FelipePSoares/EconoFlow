import React, { useState, useCallback, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootParamList } from '../../navigation/AppNavigator';
import { usePinStore } from '../../store/pinStore';
import { useLockStore } from '../../store/lockStore';
import { useAuthStore } from '../../store/authStore';
import { useBiometricStore } from '../../store/biometricStore';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

type Props = NativeStackScreenProps<RootParamList, 'PinEntry'>;

const PIN_LENGTH_MAX = 6;
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
  const { verifyPin, clearPin } = usePinStore();
  const { setUnlocked } = useLockStore();
  const { clearAuth } = useAuthStore();
  const { clearBiometric } = useBiometricStore();
  const [display, setDisplay] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const bufRef = useRef('');
  const verifyingRef = useRef(false);

  const handleForgotPin = useCallback(() => {
    clearBiometric();
    clearPin();
    clearAuth();
    navigation.reset({ index: 0, routes: [{ name: 'Auth' }] });
  }, [clearBiometric, clearPin, clearAuth, navigation]);

  const handleDigit = useCallback(async (digit: string) => {
    if (verifyingRef.current) return;
    setError(null);
    bufRef.current += digit;
    if (bufRef.current.length > PIN_LENGTH_MAX) {
      bufRef.current = bufRef.current.slice(0, -1);
      return;
    }
    setDisplay(bufRef.current);
    if (bufRef.current.length >= 4) {
      verifyingRef.current = true;
      const input = bufRef.current;
      const ok = await verifyPin(input);
      verifyingRef.current = false;
      if (ok) {
        setUnlocked();
        navigation.reset({ index: 0, routes: [{ name: 'BiometricGate' }] });
      } else {
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
      }
    }
  }, [verifyPin, setUnlocked, navigation, t, handleForgotPin]);

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
  forgotRow: { marginTop: 24, paddingVertical: 8 },
  forgotText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
});
