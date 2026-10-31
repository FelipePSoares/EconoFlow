import React from 'react';
import { View, Text, TextInput, StyleSheet, TouchableOpacity, TextInputProps } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Props extends TextInputProps {
  dark: boolean;
  icon?: string;
  /** When set, renders a currency/text symbol instead of the icon. */
  textPrefix?: string;
  placeholder: string;
  onToggleSecure?: () => void;
  showSecure?: boolean;
  hasError?: boolean;
}

export const AuroraField: React.FC<Props> = ({
  dark, icon, textPrefix, placeholder, onToggleSecure, showSecure, hasError, style: _style, testID, ...rest
}) => {
  const ink  = dark ? '#e6edf3' : '#0d2137';
  const ink2 = dark ? '#8aa0b6' : '#5b6b7c';
  const bg   = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.68)';
  const border = dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.8)';
  const errorBorder = '#e74c3c';

  return (
    <View style={[
      styles.row,
      { backgroundColor: bg, borderColor: hasError ? errorBorder : border },
    ]}>
      {textPrefix ? (
        <Text style={[styles.textPrefix, { color: ink2 }]}>{textPrefix}</Text>
      ) : icon ? (
        <MaterialCommunityIcons name={icon as never} size={20} color={ink2} style={styles.icon} />
      ) : null}
      {/* The `testID` belongs to the input itself, not to the decorated row: the
          integration tests (e2e/) type into it directly, and a matcher on the row would
          not reach the editable native view. */}
      <TextInput
        testID={testID}
        placeholder={placeholder}
        placeholderTextColor={ink2}
        style={[styles.input, { color: ink }]}
        {...rest}
      />
      {onToggleSecure && (
        <TouchableOpacity onPress={onToggleSecure} style={styles.eyeBtn}>
          <MaterialCommunityIcons
            name={showSecure ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color={ink2}
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 11,
  },
  icon:       { marginRight: 10 },
  textPrefix: { fontSize: 16, fontWeight: '700', marginRight: 10, minWidth: 22, textAlign: 'center' },
  input:      { flex: 1, fontSize: 14.5, fontWeight: '500' },
  eyeBtn:     { padding: 2 },
});
