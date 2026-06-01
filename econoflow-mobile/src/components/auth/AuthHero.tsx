import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';
import { auroraTokens } from '../../theme/useAuroraSkin';

interface Props {
  dark: boolean;
  subtitle?: string;
}

/**
 * Brand block rendered at the top of every auth screen.
 * No background — GlassScreen (the parent) provides the frosted aurora bg.
 */
export const AuthHero: React.FC<Props> = ({ dark, subtitle }) => {
  const { ink, ink2 } = auroraTokens(dark);

  return (
    <View style={styles.wrap}>
      <View style={[styles.iconWrap, dark ? styles.iconDark : styles.iconLight]}>
        <Image
          source={
            dark
              ? require('../../../assets/logo-icon-light.png')
              : require('../../../assets/logo-icon-dark.png')
          }
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      <Text style={[styles.wordmark, { color: ink }]}>
        Econo<Text style={styles.accent}>Flow</Text>
      </Text>

      {subtitle ? (
        <Text style={[styles.subtitle, { color: ink2 }]}>{subtitle}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 56,
    paddingBottom: 36,
  },
  iconWrap: {
    width: 80,
    height: 80,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconDark: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  iconLight: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.90)',
    shadowColor: 'rgba(15,74,106,0.18)',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
  },
  logo:     { width: 50, height: 50 },
  wordmark: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  accent:   { color: '#0f76a8' },
  subtitle: { fontSize: 13, fontWeight: '600' },
});
