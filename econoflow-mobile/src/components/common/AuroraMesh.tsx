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
  { color: '#0f76a8', opacity: 0.90, size: 180, top: -70,  left: -70 },
  { color: '#14c08a', opacity: 0.72, size: 160, top: 160,  right: -65 },
  { color: '#2f6df0', opacity: 0.58, size: 150, top: 400,  left: -15 },
  { color: '#0f76a8', opacity: 0.68, size: 165, bottom: 80, right: -65 },
];

const LIGHT_BLOBS: Blob[] = [
  { color: '#54b4dd', opacity: 0.78, size: 170, top: -60,  left: -60 },
  { color: '#4ed6a6', opacity: 0.65, size: 155, top: 150,  right: -55 },
  { color: '#7ba2f2', opacity: 0.58, size: 145, top: 380,  left: -10 },
  { color: '#54b4dd', opacity: 0.55, size: 155, bottom: 90, right: -55 },
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
