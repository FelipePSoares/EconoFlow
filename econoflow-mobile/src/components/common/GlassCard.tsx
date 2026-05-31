import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  dark: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  radius?: number;
  intensity?: number;
}

/**
 * Glass-morphism card.
 *
 * Uses layered translucent gradients (no BlurView — expo-blur can't reliably
 * blur absolutely-positioned siblings on Android) to create a frosted mirror
 * effect.  `intensity` controls how opaque the base layer is (0 = sheer,
 * 100 = solid).
 */
export const GlassCard: React.FC<Props> = ({
  dark, style, children, radius = 22, intensity = 50,
}) => {
  const pct = Math.max(0, Math.min(intensity, 100)) / 100;

  // Base layer opacity range
  const base   = dark ? 0.15 + pct * 0.45  : 0.30 + pct * 0.55;  // bottom of gradient
  const baseHi = dark ? 0.10 + pct * 0.35  : 0.22 + pct * 0.50;  // top (slightly more translucent)

  const bgColor    = dark ? 'rgba(12,26,43,'  : 'rgba(255,255,255,';
  const borderColor = dark
    ? 'rgba(255,255,255,0.14)'
    : 'rgba(255,255,255,0.85)';

  return (
    <View style={[{ borderRadius: radius, overflow: 'hidden', borderWidth: 1, borderColor }, style]}>
      {/* Frosted base — vertical gradient for depth */}
      <LinearGradient
        colors={[
          `${bgColor}${baseHi.toFixed(2)})`,
          `${bgColor}${base.toFixed(2)})`,
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      {/* Diagonal mirror-reflection sheen */}
      <LinearGradient
        colors={[
          dark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.38)',
          'transparent',
          dark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)',
        ]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      {/* Content sits above all layers */}
      <View style={{ position: 'relative' }}>
        {children}
      </View>
    </View>
  );
};
