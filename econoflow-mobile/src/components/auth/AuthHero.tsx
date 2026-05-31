import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { AuroraMesh } from '../common/AuroraMesh';

interface Props {
  dark: boolean;
  subtitle?: string;
}

export const AuthHero: React.FC<Props> = ({ dark, subtitle }) => {
  const ink = dark ? '#e6edf3' : '#0d2137';
  const ink2 = dark ? '#8aa0b6' : '#5b6b7c';

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#061e33' : '#e6eff6' }]}>
      <AuroraMesh dark={dark} />

      {/* Brand */}
      <View style={styles.brand}>
        <View style={[styles.iconWrap, dark ? styles.iconDark : styles.iconLight]}>
          <Image
            source={dark
              ? require('../../../assets/logo-icon-light.png')
              : require('../../../assets/logo-icon-dark.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.wordmark, { color: ink }]}>
          Econo<Text style={{ color: '#0f76a8' }}>Flow</Text>
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: ink2 }]}>{subtitle}</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 64,
    paddingBottom: 40,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  brand: {
    alignItems: 'center',
    gap: 8,
    zIndex: 1,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  iconDark: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  iconLight: {
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    shadowColor: 'rgba(15,74,106,0.15)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 8,
  },
  logo: {
    width: 48,
    height: 48,
  },
  wordmark: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
});
