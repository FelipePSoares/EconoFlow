import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface Props {
  /** Outer diameter of the ring in dp. */
  size: number;
  /** Stroke width (ring thickness). */
  strokeWidth: number;
  /** 0–1 fill fraction. */
  progress: number;
  /** Progress arc colour. */
  color: string;
  /** Track (background ring) colour. */
  trackColor: string;
  /** Content rendered inside the hole. */
  children?: React.ReactNode;
}

/**
 * SVG donut ring with a smooth arc for the progress portion.
 * Used for category budget rings and the overall budget indicator.
 */
export const DonutRing: React.FC<Props> = ({
  size, strokeWidth, progress, color, trackColor, children,
}) => {
  const r        = (size - strokeWidth) / 2;
  const cx       = size / 2;
  const circ     = 2 * Math.PI * r;
  const pct      = Math.min(Math.max(progress, 0), 1);
  const dashOffset = circ * (1 - pct);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size}
        style={{ position: 'absolute' }}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Track ring */}
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc — starts at 12 o'clock (rotation −90°) */}
        <Circle
          cx={cx}
          cy={cx}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${cx}, ${cx}`}
        />
      </Svg>
      {children}
    </View>
  );
};
