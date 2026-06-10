import React from 'react';
import { TouchableOpacity, StyleSheet, ActivityIndicator, View } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: string;
  testID?: string;
}

export const AuroraPrimaryButton: React.FC<Props> = ({ label, onPress, loading, disabled, icon, testID }) => (
  <TouchableOpacity
    testID={testID}
    onPress={onPress}
    disabled={loading || disabled}
    activeOpacity={0.82}
    style={[styles.btn, (loading || disabled) && styles.btnDisabled]}
  >
    {/* Teal → green gradient from the design */}
    <LinearGradient
      colors={['#0f76a8', '#14c08a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
    <View style={styles.row}>
      {loading
        ? <ActivityIndicator color="#fff" />
        : (
          <>
            <Text style={styles.label}>{label}</Text>
            {icon && (
              <MaterialCommunityIcons
                name={icon as never}
                size={20}
                color="#fff"
                style={{ marginLeft: 6 }}
              />
            )}
          </>
        )}
    </View>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  btn: {
    marginTop: 18,
    height: 54,
    borderRadius: 17,
    overflow: 'hidden',   // clips the gradient to the rounded corners
    shadowColor: 'rgba(15,118,168,0.55)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 28,
    elevation: 10,
  },
  btnDisabled: { opacity: 0.6 },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { color: '#fff', fontSize: 15.5, fontWeight: '800' },
});
