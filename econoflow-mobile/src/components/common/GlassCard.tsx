import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';

interface Props {
  dark: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  radius?: number;
  intensity?: number;
}

/**
 * A frosted-glass card using expo-blur.
 * The BlurView blurs whatever is rendered behind it, giving the real glass effect.
 */
export const GlassCard: React.FC<Props> = ({
  dark, style, children, radius = 22, intensity = 55,
}) => {
  const overlayColor = dark
    ? 'rgba(12,26,43,0.45)'   // dark tint so content is legible
    : 'rgba(255,255,255,0.55)'; // light tint
  const borderColor = dark
    ? 'rgba(255,255,255,0.14)'
    : 'rgba(255,255,255,0.85)';

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor }, style]}>
      <BlurView
        intensity={intensity}
        tint={dark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      {/* Colour overlay on top of blur */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
      {/* Content sits above both layers */}
      <View style={{ position: 'relative' }}>
        {children}
      </View>
    </View>
  );
};
