import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
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
  const { clearAuth } = useAuthStore();
  const { clearBiometric } = useBiometricStore();

  const [mode, setMode] = useState<'biometric' | 'pin'>(
    !biometricEnabled || !hasPin ? 'pin' : 'biometric'
  );
  const [pin, setPinValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);

  const handleForgotPin = useCallback(() => {
    clearBiometric();
    clearPin();
    clearAuth();
  }, [clearBiometric, clearPin, clearAuth]);

  useEffect(() => {
    if (!biometricEnabled || !hasPin) return;

    let cancelled = false;

    const run = async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();
      if (cancelled) return;

      if (!hasHardware || !isEnrolled) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMode('pin');
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t('BiometricPromptReason'),
        cancelLabel: t('ButtonCancel'),
        disableDeviceFallback: false,
      });

      if (cancelled) return;

      if (result.success) {
        setUnlocked();
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMode('pin');
      }
    };

    run();

    return () => { cancelled = true; };
  }, [biometricEnabled, hasPin, setUnlocked, t]);

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

  const handleRetryBiometric = async () => {
    setError(null);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: t('BiometricPromptReason'),
      cancelLabel: t('ButtonCancel'),
      disableDeviceFallback: false,
    });
    if (result.success) {
      setUnlocked();
    } else {
      setMode('pin');
    }
  };

  const remaining = MAX_ATTEMPTS - attempts;

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

          {mode === 'pin' && (
            <>
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

              <KeyPad onDigit={handleDigit} onBackspace={handleBackspace} />

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

          {mode === 'biometric' && (
            <GlassCard dark={dark} radius={20} style={styles.card}>
              <View style={styles.buttonRow}>
                <View style={styles.retryBtn}>
                  <Text
                    style={[styles.retryText, { color: '#0f76a8' }]}
                    onPress={handleRetryBiometric}
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
