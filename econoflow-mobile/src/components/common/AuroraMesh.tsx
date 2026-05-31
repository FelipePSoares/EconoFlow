import React from 'react';
import { View } from 'react-native';

interface Blob {
  color: string;
  opacity: number;
  size: number;
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

const DARK_BLOBS: Blob[] = [
  { color: '#0f76a8', opacity: 0.65, size: 300, top: -80, left: -60 },
  { color: '#14c08a', opacity: 0.4,  size: 280, top: 60,  right: -90 },
  { color: '#2f6df0', opacity: 0.28, size: 260, top: 300, left: 20 },
  { color: '#0f76a8', opacity: 0.35, size: 240, bottom: 50, right: -50 },
];

const LIGHT_BLOBS: Blob[] = [
  { color: '#54b4dd', opacity: 0.45, size: 280, top: -70,  left: -50 },
  { color: '#4ed6a6', opacity: 0.38, size: 260, top: 60,   right: -80 },
  { color: '#7ba2f2', opacity: 0.32, size: 240, top: 300,  left: 30 },
  { color: '#54b4dd', opacity: 0.3,  size: 220, bottom: 60, right: -40 },
];

interface Props {
  dark?: boolean;
}

export const AuroraMesh: React.FC<Props> = ({ dark }) => {
  const blobs = dark ? DARK_BLOBS : LIGHT_BLOBS;
  return (
    <>
      {blobs.map((b, i) => (
        <View
          key={i}
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: b.size,
            height: b.size,
            borderRadius: b.size / 2,
            backgroundColor: b.color,
            opacity: b.opacity,
            ...(b.top    !== undefined ? { top: b.top }       : {}),
            ...(b.bottom !== undefined ? { bottom: b.bottom } : {}),
            ...(b.left   !== undefined ? { left: b.left }     : {}),
            ...(b.right  !== undefined ? { right: b.right }   : {}),
          }}
        />
      ))}
    </>
  );
};
