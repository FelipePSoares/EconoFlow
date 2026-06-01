/**
 * BlurTarget — a forwardRef-capable native blur target for Android.
 *
 * Why this file exists:
 *   expo-blur's `BlurTargetView` is a plain function component (no forwardRef),
 *   so any `ref` you attach to it is always null.  BlurView then sees
 *   `blurTarget.current === null`, logs a warning, and falls back to
 *   blurMethod='none' — i.e. a plain tinted overlay with zero blur.
 *
 *   We bypass the broken wrapper and import the underlying native view
 *   (ExpoBlurTargetView) directly.  Native components support refs natively,
 *   so `findNodeHandle(blurTargetRef.current)` returns a valid handle and
 *   real Dimezis blur works on Android SDK ≥ 31.
 *
 * On iOS this component is never rendered — BlurView blurs whatever is behind
 * it without needing a blurTarget at all.
 */
import React from 'react';
import { View, ViewProps } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;

function loadNativeBlurTarget(): AnyComponent | null {
  try {
    // Internal expo-blur path — stable within the same minor version.
    // If this ever breaks on an expo upgrade, fall back gracefully.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-blur/build/NativeBlurModule').NativeBlurTargetView as AnyComponent;
  } catch {
    return null;
  }
}

const NativeBlurTargetView = loadNativeBlurTarget();

/**
 * Drop-in replacement for expo-blur's BlurTargetView that actually forwards
 * its ref to the native ExpoBlurTargetView node.
 *
 * Usage (Android):
 *   const ref = useRef<View>(null);
 *   <BlurTarget ref={ref} style={StyleSheet.absoluteFill} pointerEvents="none">
 *     <Background />
 *   </BlurTarget>
 *   <BlurView blurTarget={ref} blurMethod="dimezisBlurViewSdk31Plus" ... />
 */
export const BlurTarget = React.forwardRef<View, ViewProps>(function BlurTarget(props, ref) {
  if (NativeBlurTargetView) {
    return <NativeBlurTargetView ref={ref} {...props} />;
  }
  // Fallback: plain View — blur won't use a target but the app won't crash.
  return <View ref={ref} {...props} />;
});
