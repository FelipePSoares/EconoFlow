import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { ProfileStackParamList } from '../../navigation/ProfileStackNavigator';
import { useAuthStore } from '../../store/authStore';
import { useUpdateProfile } from '../../hooks/useUpdateProfile';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import i18n from '../../i18n';
import { captureError } from '../../monitoring/sentry';

type Props = NativeStackScreenProps<ProfileStackParamList, 'LanguagePicker'>;

const SUPPORTED_LANGUAGES: { code: string; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'pt', label: 'Português' },
];

export const LanguagePickerScreen: React.FC<Props> = ({ navigation: _navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2, hair } = useAuroraSkin();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { mutateAsync } = useUpdateProfile();

  const [apiError, setApiError] = useState('');
  const currentLang = user?.languageCode ?? 'en';

  const handleSelect = async (code: string) => {
    setApiError('');
    try {
      await mutateAsync([{ op: 'replace', path: '/languageCode', value: code }]);
      i18n.changeLanguage(code);
    } catch (err) {
      captureError(err, { screen: 'LanguagePickerScreen', action: 'updateLanguage' });
      setApiError(t('ErrorGeneric') ?? 'Something went wrong. Please try again.');
    }
  };

  return (
    <GlassScreen dark={dark}>
      <ErrorBanner visible={!!apiError} message={apiError} onDismiss={() => setApiError('')} />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 32 }]}
      >
        <Text style={[styles.title, { color: ink }]}>{t('LabelLanguage') ?? 'Language'}</Text>

        <GlassCard dark={dark} radius={20} style={styles.card}>
          {SUPPORTED_LANGUAGES.map((lang, idx) => {
            const isSelected = currentLang === lang.code;
            const isLast = idx === SUPPORTED_LANGUAGES.length - 1;
            return (
              <TouchableOpacity
                key={lang.code}
                onPress={() => handleSelect(lang.code)}
                activeOpacity={0.7}
                testID={`lang-${lang.code}`}
                style={[
                  styles.langRow,
                  { borderBottomColor: isLast ? 'transparent' : hair },
                ]}
              >
                <Text style={[styles.langLabel, { color: ink }]}>{lang.label}</Text>
                {isSelected && (
                  <View testID={`lang-${lang.code}-selected`}>
                    <MaterialCommunityIcons name="check" size={20} color="#0f76a8" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </GlassCard>

        <Text style={[styles.hint, { color: ink2 }]}>
          {t('PlaceholderLanguage') ?? 'Select your language'}
        </Text>
      </ScrollView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  fill:    { flex: 1 },
  scroll:  { paddingHorizontal: 24 },
  title:   { fontSize: 24, fontWeight: '800', marginBottom: 16 },
  card:    { marginBottom: 12 },
  langRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  langLabel: { fontSize: 15, fontWeight: '600' },
  hint:      { fontSize: 12, textAlign: 'center', marginTop: 8 },
});
