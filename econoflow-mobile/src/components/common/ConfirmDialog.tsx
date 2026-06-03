import React from 'react';
import { Modal, View, StyleSheet, TouchableOpacity, useColorScheme } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { auroraTokens } from '../../theme/useAuroraSkin';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<Props> = ({
  visible, title, message, onConfirm, onCancel,
}) => {
  const { t } = useTranslation();
  const dark = useColorScheme() === 'dark';
  const { ink, ink2 } = auroraTokens(dark);

  const panelBg     = dark ? '#061e33' : '#eaf3fb';
  const panelBorder = dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.92)';
  const cancelBorder = dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop} />
      <View style={styles.centeredWrap} pointerEvents="box-none">
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onCancel} activeOpacity={1} />
        <View style={[styles.panel, { backgroundColor: panelBg, borderColor: panelBorder }]}>
          <View style={styles.iconWrap}>
            <MaterialCommunityIcons name="alert-circle-outline" size={36} color="#e74c3c" />
          </View>
          <Text style={[styles.title, { color: ink }]}>{title}</Text>
          <Text style={[styles.message, { color: ink2 }]}>{message}</Text>
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn, { borderColor: cancelBorder }]}
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, { color: ink2 }]}>{t('ButtonCancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={[styles.btnText, styles.confirmText]}>
                {t('ButtonConfirm', { defaultValue: 'Confirm' })}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.60)' },
  centeredWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  panel: {
    width: '100%',
    borderRadius: 26,
    borderWidth: 1,
    padding: 28,
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  iconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(231,76,60,0.12)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 21, marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8, width: '100%' },
  btn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: 'center' },
  cancelBtn: { borderWidth: 1 },
  confirmBtn: { backgroundColor: '#e74c3c' },
  btnText: { fontSize: 14.5, fontWeight: '700' },
  confirmText: { color: '#fff' },
});
