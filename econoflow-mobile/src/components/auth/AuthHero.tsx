import React from 'react';
import { View, StyleSheet, Image, Dimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';

const { width } = Dimensions.get('window');

interface Props {
  subtitle?: string;
}

export const AuthHero: React.FC<Props> = ({ subtitle }) => {
  const { t } = useTranslation();

  return (
    <LinearGradient
      colors={['#061e33', '#0c3350', '#0f4a6a']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <View style={styles.heroContent}>
        <Image
          source={require('../../../assets/logo-icon-light.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text variant="bodyMedium" style={styles.subtitle}>
          {subtitle ?? t('ShortIndexWebSiteDescription')}
        </Text>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  hero: {
    paddingTop: 60,
    paddingBottom: 36,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroContent: {
    alignItems: 'center',
    gap: 8,
  },
  logo: {
    width: width * 0.28,
    height: 56,
  },
  subtitle: {
    color: 'rgba(235, 247, 255, 0.78)',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
});
