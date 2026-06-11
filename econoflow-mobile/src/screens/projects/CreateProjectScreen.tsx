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
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { ProjectStackParamList } from '../../navigation/ProjectStackNavigator';
import type { RootParamList } from '../../navigation/AppNavigator';
import { useCreateProject } from '../../hooks/useProjects';
import { putTaxYearSettings } from '../../api/projects.api';
import { captureError } from '../../monitoring/sentry';
import { useProjectStore } from '../../store/projectStore';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { CurrencyPickerField } from '../../components/common/CurrencyPickerField';

type Props = {
  navigation: NativeStackNavigationProp<ProjectStackParamList, 'CreateProject'>;
  route?: RouteProp<ProjectStackParamList, 'CreateProject'>;
};

type TaxYearType = 'CalendarYear' | 'CustomStartMonth';
type TaxYearLabeling = 'ByStartYear' | 'ByEndYear';

interface FormValues {
  name: string;
  preferredCurrency: string;
  taxYearStartMonth: string;
  taxYearStartDay: string;
}

const TOGGLE_GRADIENT: [string, string] = ['#0f76a8', '#14c08a'];

export const CreateProjectScreen: React.FC<Props> = ({ navigation, route }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const insets = useSafeAreaInsets();
  const createProject = useCreateProject();
  const { setSelectedProject } = useProjectStore();
  const fromOnboarding = route?.params?.fromOnboarding ?? false;

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
      navigation.navigate('SmartSetup', { projectId: userProject.project.id, fromOnboarding });
    } catch (err) {
      captureError(err, { screen: 'CreateProjectScreen', action: 'createProject' });
      setError(t('ErrorGeneric'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleBg = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.52)';
  const toggleBorder = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.86)';

  const renderToggle = (
    options: [string, string][],
    activeValue: string,
    onChange: (v: string) => void,
  ) => (
    <View style={styles.toggleRow}>
      {options.map(([v, labelKey]) => {
        const active = activeValue === v;
        return (
          <TouchableOpacity
            key={v}
            style={[
              styles.toggleBtn,
              { backgroundColor: active ? 'transparent' : toggleBg,
                borderColor: active ? '#0f76a8' : toggleBorder },
            ]}
            onPress={() => onChange(v)}
          >
            {active && (
              <LinearGradient
                colors={TOGGLE_GRADIENT}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            )}
            <Text style={[styles.toggleBtnText, { color: active ? '#fff' : ink }]}>
              {t(labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  return (
    <GlassScreen dark={dark}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Nav bar ── */}
        <View style={[styles.navBar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity
            testID="nav-back-btn"
            style={[styles.navBackBtn, { backgroundColor: toggleBg, borderColor: toggleBorder }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={ink} />
          </TouchableOpacity>

          <Text style={[styles.navTitle, { color: ink }]} numberOfLines={1}>
            {t('CreateProject')}
          </Text>

          <View style={styles.navSpacer} />
        </View>

        {/* ── Scrollable body ── */}
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <GlassCard dark={dark} radius={26} style={styles.card}>

            {/* Project name */}
            <Text style={[styles.sectionLabel, { color: ink2 }]}>
              {t('LabelProjectName')}
            </Text>
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
            <Text style={[styles.sectionLabel, { color: ink2 }]}>
              {t('FieldCurrency')}
            </Text>
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
            {renderToggle(
              [
                ['CalendarYear', 'TaxYearTypeCalendar'],
                ['CustomStartMonth', 'TaxYearTypeCustom'],
              ],
              taxYearType,
              v => setTaxYearType(v as TaxYearType),
            )}

            {/* Conditional custom tax year fields */}
            {taxYearType === 'CustomStartMonth' && (
              <>
                <View style={styles.monthDayRow}>
                  <View style={styles.monthDayField}>
                    <Text style={[styles.fieldSubLabel, { color: ink2 }]}>
                      {t('FieldTaxYearStartMonth')}
                    </Text>
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
                          placeholder="1 – 12"
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
                  </View>

                  <View style={styles.monthDayField}>
                    <Text style={[styles.fieldSubLabel, { color: ink2 }]}>
                      {t('FieldTaxYearStartDay')}
                    </Text>
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
                          placeholder="1 – 31"
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
                  </View>
                </View>

                {/* Year labeling toggle */}
                <Text style={[styles.sectionLabel, { color: ink2 }]}>
                  {t('FieldTaxYearLabeling')}
                </Text>
                {renderToggle(
                  [
                    ['ByStartYear', 'TaxYearLabelingByStart'],
                    ['ByEndYear', 'TaxYearLabelingByEnd'],
                  ],
                  taxYearLabeling,
                  v => setTaxYearLabeling(v as TaxYearLabeling),
                )}
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

          {fromOnboarding ? (
            /* Skip — exits onboarding entirely */
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: toggleBg, borderColor: toggleBorder }]}
              onPress={() =>
                navigation
                  .getParent()
                  ?.getParent<NativeStackNavigationProp<RootParamList>>()
                  ?.dispatch(
                    CommonActions.reset({ index: 0, routes: [{ name: 'Main' }] }),
                  )
              }
            >
              <Text style={[styles.cancelText, { color: ink2 }]}>{t('OnboardingSkip')}</Text>
            </TouchableOpacity>
          ) : (
            /* Cancel — goes back in ProjectStack */
            <TouchableOpacity
              style={[styles.cancelBtn, { backgroundColor: toggleBg, borderColor: toggleBorder }]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.cancelText, { color: ink2 }]}>{t('ButtonCancel')}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },

  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
    flexShrink: 0,
  },
  navBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle:   { fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center', marginHorizontal: 8 },
  navSpacer:  { width: 42 },

  scroll: { flexGrow: 1, paddingHorizontal: 22 },
  card:   { padding: 22, marginBottom: 16 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginTop: 20,
    marginBottom: 0,
  },
  fieldSubLabel: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 0,
  },

  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    overflow: 'hidden',
  },
  toggleBtnText: { fontSize: 13, fontWeight: '700' },

  monthDayRow:   { flexDirection: 'row', gap: 10 },
  monthDayField: { flex: 1 },

  cancelBtn: {
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginBottom: 8,
  },
  cancelText: { fontSize: 14, fontWeight: '600' },
});
