import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  icon?: string;
}

export const AuroraPrimaryButton: React.FC<Props> = ({ label, onPress, loading, icon }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.82}
    style={[styles.btn, loading && styles.btnDisabled]}
  >
    {loading
      ? <ActivityIndicator color="#fff" />
      : (
        <>
          <Text style={styles.label}>{label}</Text>
          {icon && (
            <MaterialCommunityIcons name={icon as never} size={20} color="#fff" style={{ marginLeft: 6 }} />
          )}
        </>
      )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  btn: {
    marginTop: 18,
    height: 54,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    backgroundColor: '#0f76a8',
    shadowColor: 'rgba(15,118,168,0.5)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 10,
  },
  btnDisabled: { opacity: 0.6 },
  label: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
});
