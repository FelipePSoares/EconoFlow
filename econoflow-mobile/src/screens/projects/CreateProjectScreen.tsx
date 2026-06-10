import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProjectStackParamList } from '../../navigation/ProjectStackNavigator';
import { useCreateProject } from '../../hooks/useProjects';
import { putTaxYearSettings } from '../../api/projects.api';
import { useProjectStore } from '../../store/projectStore';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AuthHero } from '../../components/auth/AuthHero';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { CurrencyPickerField } from '../../components/common/CurrencyPickerField';

type Props = {
  navigation: NativeStackNavigationProp<ProjectStackParamList, 'CreateProject'>;
};

type TaxYearType = 'CalendarYear' | 'CustomStartMonth';
type TaxYearLabeling = 'ByStartYear' | 'ByEndYear';

interface FormValues {
  name: string;
  preferredCurrency: string;
  taxYearStartMonth: string;
  taxYearStartDay: string;
}

export const CreateProjectScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2, hair } = useAuroraSkin();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const createProject = useCreateProject();
  const { setSelectedProject } = useProjectStore();

  const [taxYearType, setTaxYearType] = useState<TaxYearType>('CalendarYear');
  const [taxYearLabeling, setTaxYearLabeling] = useState<TaxYearLabeling>('ByStartYear');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: '',
      preferredCurrency: 'EUR',
      taxYearStartMonth: '',
      taxYearStartDay: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const userProject = await createProject.mutateAsync({
        name: values.name,
        preferredCurrency: values.preferredCurrency.toUpperCase(),
      });

      await putTaxYearSettings(userProject.project.id, {
        taxYearType,
        ...(taxYearType === 'CustomStartMonth' && {
          taxYearStartMonth: parseInt(values.taxYearStartMonth, 10),
          taxYearStartDay: parseInt(values.taxYearStartDay, 10),
          taxYearLabeling,
        }),
      });

      setSelectedProject(userProject);
      navigation.navigate('SmartSetup', { projectId: userProject.project.id });
    } catch {
      setError(t('ErrorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleBg = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.52)';
  const toggleBorder = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.86)';
  const activeBg = colors.primary;

  return (
    <GlassScreen dark={dark}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <AuthHero dark={dark} subtitle={t('CreateEditProject')} />

          <GlassCard dark={dark} radius={26} style={styles.card}>
            <Text style={[styles.cardTitle, { color: ink }]}>
              {t('CreateEditProject')}
            </Text>

            {/* Project name */}
            <Controller
              control={control}
              name="name"
              rules={{
                required: t('RequiredField'),
                maxLength: { value: 60, message: t('PropertyMaxLength', { field: t('FieldProjectName'), max: 60 }) },
              }}
              render={({ field: { onChange, value } }) => (
                <AuroraField
                  dark={dark}
                  icon="folder-outline"
                  testID={t('PlaceholderProjectName')}
                  placeholder={t('PlaceholderProjectName')}
                  value={value}
                  onChangeText={onChange}
                  hasError={!!errors.name}
                  autoCorrect={false}
                />
              )}
            />
            {errors.name && (
              <HelperText type="error">{errors.name.message}</HelperText>
            )}

            {/* Currency */}
            <Controller
              control={control}
              name="preferredCurrency"
              rules={{ required: t('RequiredField') }}
              render={({ field: { onChange, value } }) => (
                <CurrencyPickerField
                  dark={dark}
                  testID="currency-picker-field"
                  value={value}
                  onChange={onChange}
                  hasError={!!errors.preferredCurrency}
                />
              )}
            />
            {errors.preferredCurrency && (
              <HelperText type="error">{errors.preferredCurrency.message}</HelperText>
            )}

            {/* Tax year type toggle */}
            <Text style={[styles.sectionLabel, { color: ink2 }]}>
              {t('FieldTaxYearType')}
            </Text>
            <View style={[styles.toggleRow, { borderColor: hair }]}>
              {(['CalendarYear', 'CustomStartMonth'] as const).map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.toggleBtn,
                    {
                      backgroundColor: taxYearType === type ? activeBg : toggleBg,
                      borderColor: taxYearType === type ? activeBg : toggleBorder,
                    },
                  ]}
                  onPress={() => setTaxYearType(type)}
                >
                  <Text
                    style={[
                      styles.toggleBtnText,
                      { color: taxYearType === type ? '#fff' : ink },
                    ]}
                  >
                    {t(type === 'CalendarYear' ? 'TaxYearTypeCalendar' : 'TaxYearTypeCustom')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Conditional custom tax year fields */}
            {taxYearType === 'CustomStartMonth' && (
              <>
                <Controller
                  control={control}
                  name="taxYearStartMonth"
                  rules={{
                    required: t('RequiredField'),
                    validate: (v) => {
                      const n = parseInt(v, 10);
                      return (n >= 1 && n <= 12) || t('OnlyNumbersIsValid');
                    },
                  }}
                  render={({ field: { onChange, value } }) => (
                    <AuroraField
                      dark={dark}
                      icon="calendar-month-outline"
                      testID={t('FieldTaxYearStartMonth')}
                      placeholder={t('FieldTaxYearStartMonth')}
                      value={value}
                      onChangeText={onChange}
                      keyboardType="number-pad"
                      maxLength={2}
                      hasError={!!errors.taxYearStartMonth}
                    />
                  )}
                />
                {errors.taxYearStartMonth && (
                  <HelperText type="error">{errors.taxYearStartMonth.message}</HelperText>
                )}

                <Controller
                  control={control}
                  name="taxYearStartDay"
                  rules={{
                    required: t('RequiredField'),
                    validate: (v) => {
                      const n = parseInt(v, 10);
                      return (n >= 1 && n <= 31) || t('OnlyNumbersIsValid');
                    },
                  }}
                  render={({ field: { onChange, value } }) => (
                    <AuroraField
                      dark={dark}
                      icon="calendar-today"
                      testID={t('FieldTaxYearStartDay')}
                      placeholder={t('FieldTaxYearStartDay')}
                      value={value}
                      onChangeText={onChange}
                      keyboardType="number-pad"
                      maxLength={2}
                      hasError={!!errors.taxYearStartDay}
                    />
                  )}
                />
                {errors.taxYearStartDay && (
                  <HelperText type="error">{errors.taxYearStartDay.message}</HelperText>
                )}

                {/* Year labeling toggle */}
                <Text style={[styles.sectionLabel, { color: ink2 }]}>
                  {t('FieldTaxYearLabeling')}
                </Text>
                <View style={[styles.toggleRow, { borderColor: hair }]}>
                  {(['ByStartYear', 'ByEndYear'] as const).map((label) => (
                    <TouchableOpacity
                      key={label}
                      style={[
                        styles.toggleBtn,
                        {
                          backgroundColor: taxYearLabeling === label ? activeBg : toggleBg,
                          borderColor: taxYearLabeling === label ? activeBg : toggleBorder,
                        },
                      ]}
                      onPress={() => setTaxYearLabeling(label)}
                    >
                      <Text
                        style={[
                          styles.toggleBtnText,
                          { color: taxYearLabeling === label ? '#fff' : ink },
                        ]}
                      >
                        {t(label === 'ByStartYear' ? 'TaxYearLabelingByStart' : 'TaxYearLabelingByEnd')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <ErrorBanner
              visible={!!error}
              message={error ?? undefined}
              onDismiss={() => setError(null)}
            />

            <AuroraPrimaryButton
              testID={t('ButtonCreate')}
              label={t('ButtonCreate')}
              onPress={handleSubmit(onSubmit)}
              loading={isSubmitting}
              icon="arrow-right"
            />
          </GlassCard>

          {/* Cancel */}
          <TouchableOpacity
            style={[styles.cancelBtn, { backgroundColor: toggleBg, borderColor: toggleBorder }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.cancelText, { color: ink2 }]}>{t('ButtonCancel')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  card: { padding: 22, marginBottom: 16 },
  cardTitle: { fontSize: 19, fontWeight: '800', marginBottom: 12 },
  sectionLabel: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 6 },
  toggleRow: { flexDirection: 'row', gap: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  toggleBtnText: { fontSize: 13, fontWeight: '600' },
  cancelBtn: {
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelText: { fontSize: 14, fontWeight: '600' },
});
