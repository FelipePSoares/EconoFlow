import React from 'react';
import { View, StyleProp, ViewStyle, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface Props {
  dark: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  radius?: number;
  /** Kept for API compatibility — ignored (GlassScreen owns the blur). */
  intensity?: number;
}

/**
 * A frosted-glass card panel.
 *
 * The actual background blur is provided by the parent GlassScreen's
 * global BlurView — this component just adds:
 *   - a semi-transparent colour tint for legibility
 *   - a thin white border
 *   - a subtle diagonal LinearGradient "mirror-reflection" sheen
 *
 * No per-card BlurView is used (would fight the global blur and hurt perf).
 */
export const GlassCard: React.FC<Props> = ({
  dark, style, children, radius = 22,
}) => {
  // Dark mode: very light white tint (same family as the auth icon container)
  // Light mode: white-glass tint for definition against the blurred background
  const tintBg = dark
    ? 'rgba(255, 255, 255, 0.07)'
    : 'rgba(255, 255, 255, 0.52)';
  const border = dark
    ? 'rgba(255, 255, 255, 0.14)'
    : 'rgba(255, 255, 255, 0.86)';
  const sheen: [string, string, string] = dark
    ? ['rgba(255,255,255,0.10)', 'transparent', 'rgba(255,255,255,0.02)']
    : ['rgba(255,255,255,0.50)', 'transparent', 'rgba(255,255,255,0.08)'];

  return (
    <View style={[styles.container, { borderRadius: radius, borderColor: border }, style]}>
      {/* Colour tint */}
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, backgroundColor: tintBg }]} />
      {/* Diagonal mirror-reflection sheen */}
      <LinearGradient
        colors={sheen}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[StyleSheet.absoluteFill, { borderRadius: radius }]}
        pointerEvents="none"
      />
      {/* Content */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: { position: 'relative' },
});
