import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, Modal, Portal } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTranslation } from 'react-i18next';
import { useBiometricStore } from '../../store/biometricStore';
import { useAuroraSkin } from '../../theme/useAuroraSkin';

const MAX_SKIP_BEFORE_PROMPT = 3;

export const BiometricEnrollPrompt: React.FC = () => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { biometricEnabled, skipCount, setBiometricEnabled, incrementSkipCount } = useBiometricStore();
  const [visible, setVisible] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (biometricEnabled) return;

      if (skipCount >= MAX_SKIP_BEFORE_PROMPT) return;

      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!cancelled && hasHardware && isEnrolled && !biometricEnabled) {
        setChecked(true);
        setVisible(true);
      }
    };

    check();

    return () => {
      cancelled = true;
    };
  }, [biometricEnabled, skipCount]);

  const handleEnable = () => {
    setBiometricEnabled(true);
    setVisible(false);
  };

  const handleSkip = () => {
    incrementSkipCount();
    setVisible(false);
  };

  if (!checked || !visible) return null;

  return (
    <Portal>
      <Modal visible={visible} onDismiss={handleSkip} contentContainerStyle={[styles.modal, { backgroundColor: dark ? '#172233' : '#ffffff' }]}>
        <LinearGradient
          colors={['#0f76a8', '#14c08a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.iconWrap}
        >
          <MaterialCommunityIcons name="fingerprint" size={36} color="#fff" />
        </LinearGradient>

        <Text style={[styles.title, { color: ink }]}>
          {t('BiometricEnrollTitle')}
        </Text>
        <Text style={[styles.message, { color: ink2 }]}>
          {t('BiometricEnrollMessage')}
        </Text>

        <View style={styles.actions}>
          <View style={styles.enableBtn}>
            <Text
              style={styles.enableText}
              onPress={handleEnable}
            >
              {t('BiometricEnrollEnable')}
            </Text>
          </View>
          <Text
            style={[styles.skipText, { color: ink2 }]}
            onPress={handleSkip}
          >
            {t('BiometricEnrollSkip')}
          </Text>
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modal: {
    margin: 24,
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    opacity: 0.75,
  },
  actions: {
    width: '100%',
    gap: 12,
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
  skipText: {
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 13.5,
    paddingVertical: 8,
  },
});
