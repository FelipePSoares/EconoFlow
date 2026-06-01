import React, { useRef } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { AuroraMesh } from './AuroraMesh';
import { BlurTarget } from './BlurTarget';

interface Props {
  dark: boolean;
  children: React.ReactNode;
  /** 1–100. Default: 85 (dark) / 90 (light) — tuned for visible frosted effect. */
  intensity?: number;
}

export const GlassScreen: React.FC<Props> = ({ dark, children, intensity }) => {
  const blur = intensity ?? (dark ? 85 : 90);
  const blurTargetRef = useRef<View>(null);
  const bg = dark ? '#061e33' : '#e6eff6';

  if (Platform.OS === 'android') {
    return (
      <View style={[styles.fill, { backgroundColor: bg }]}>
        <BlurTarget
          ref={blurTargetRef}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <AuroraMesh dark={dark} />
        </BlurTarget>

        <BlurView
          intensity={blur}
          tint={dark ? 'dark' : 'light'}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurTarget={blurTargetRef}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.fill}>{children}</View>
      </View>
    );
  }

  return (
    <View style={[styles.fill, { backgroundColor: bg }]}>
      <AuroraMesh dark={dark} />
      <BlurView
        intensity={blur}
        tint={dark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={styles.fill}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({ fill: { flex: 1 } });
