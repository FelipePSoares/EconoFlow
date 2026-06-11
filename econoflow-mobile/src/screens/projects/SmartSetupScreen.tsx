import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import dayjs from 'dayjs';
import type { ProjectStackParamList } from '../../navigation/ProjectStackNavigator';
import type { MainTabParamList } from '../../navigation/MainNavigator';
import { useDefaultCategories, usePostSmartSetup } from '../../hooks/useSmartSetup';
import { captureError } from '../../monitoring/sentry';
import { useProjectStore } from '../../store/projectStore';
import { useUIStore } from '../../store/uiStore';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';

type Props = {
  navigation: NativeStackNavigationProp<ProjectStackParamList, 'SmartSetup'>;
  route: RouteProp<ProjectStackParamList, 'SmartSetup'>;
};

interface CategoryAllocation {
  id: string;
  name: string;
  percentage: number;
  percentageStr: string;
}

const TOTAL_STEPS = 3;
const THUMB_HALF = 10;

// ─── CategorySlider ─────────────────────────────────────────────────────────
// Extracted as a standalone component so each slider owns its width ref.
// This prevents stale-closure bugs that occur when handlers are inlined
// inside a parent .map() where React may share closure state across items.

interface CategorySliderProps {
  testID: string;
  value: number;
  onValueChange: (v: number) => void;
  fillColor: string;
  trackColor: string;
}

const CategorySlider: React.FC<CategorySliderProps> = ({
  testID,
  value,
  onValueChange,
  fillColor,
  trackColor,
}) => {
  const wrapperRef = useRef<View>(null);
  const widthRef = useRef(0);
  const pageXRef = useRef(0);
  const fillPct = Math.min(100, Math.max(0, value));

  const computePct = (pageX: number) =>
    Math.min(100, Math.max(0, Math.round(((pageX - pageXRef.current) / (widthRef.current || 1)) * 100)));

  return (
    <View
      ref={wrapperRef}
      testID={testID}
      style={sliderStyles.wrapper}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
        wrapperRef.current?.measure((_x, _y, _w, _h, px) => {
          pageXRef.current = px;
        });
      }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        const { pageX } = e.nativeEvent;
        onValueChange(computePct(pageX));
        wrapperRef.current?.measure((_x, _y, _w, _h, px) => {
          pageXRef.current = px;
        });
      }}
      onResponderMove={(e) => onValueChange(computePct(e.nativeEvent.pageX))}
    >
      <View style={[sliderStyles.track, { backgroundColor: trackColor }]}>
        <View style={[sliderStyles.fill, { width: `${fillPct}%`, backgroundColor: fillColor }]} />
      </View>
      <View
        style={[
          sliderStyles.thumb,
          { left: `${fillPct}%`, backgroundColor: fillColor, transform: [{ translateX: -THUMB_HALF }] },
        ]}
      />
    </View>
  );
};

const sliderStyles = StyleSheet.create({
  wrapper: { flex: 1, height: 24, justifyContent: 'center' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  thumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    top: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});

const getCurrencySymbol = (code: string): string => {
  try {
    const parts = new Intl.NumberFormat('en', { style: 'currency', currency: code }).formatToParts(0);
    return parts.find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
};

export const SmartSetupScreen: React.FC<Props> = ({ navigation, route }) => {
  const { projectId, fromOnboarding } = route.params;
  const { t } = useTranslation();
  const { dark, ink, ink2, hair } = useAuroraSkin();
  const { colors, customColors } = useAppTheme();
  const insets = useSafeAreaInsets();

  const [step, setStep] = useState(0);
  const [annualIncomeStr, setAnnualIncomeStr] = useState('');
  const [categories, setCategories] = useState<CategoryAllocation[]>([]);
  const [emergencyInput, setEmergencyInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const initialized = useRef(false);
  const annualIncomeInputRef = useRef<TextInput>(null);
  const emergencyInputRef = useRef<TextInput>(null);

  const { currency } = useProjectStore();
  const setHideTabBar = useUIStore((s) => s.setHideTabBar);
  const { data: defaultCategoriesData } = useDefaultCategories(projectId);
  const postSmartSetupMutation = usePostSmartSetup();

  // Keep the tab bar visible when coming from the onboarding flow so the user
  // can see the main navigation structure for the first time.
  useEffect(() => {
    if (fromOnboarding) return undefined;
    setHideTabBar(true);
    return () => { setHideTabBar(false); };
  }, [fromOnboarding, setHideTabBar]);

  useEffect(() => {
    if (defaultCategoriesData && !initialized.current) {
      initialized.current = true;
      setCategories(
        defaultCategoriesData.map((c, idx) => ({
          id: c.id ?? `default-${idx}`,
          name: c.name,
          percentage: c.percentage,
          percentageStr: String(c.percentage),
        })),
      );
    }
  }, [defaultCategoriesData]);

  const annualIncome = parseFloat(annualIncomeStr) || 0;
  const monthlyIncome = annualIncome / 12;

  const incomeParts = annualIncomeStr ? annualIncomeStr.split('.') : [];
  const incomeIntStr = incomeParts[0] || '0';
  const incomeDecStr = `.${(incomeParts[1] ?? '00').padEnd(2, '0').slice(0, 2)}`;

  const reserveParts = emergencyInput ? emergencyInput.split('.') : [];
  const reserveIntStr = reserveParts[0] || '0';
  const reserveDecStr = `.${(reserveParts[1] ?? '00').padEnd(2, '0').slice(0, 2)}`;

  const percentageTotal = categories.reduce(
    (sum, c) => sum + (parseFloat(c.percentageStr) || 0),
    0,
  );

  const navigateToOverview = () => {
    navigation.dispatch(
      CommonActions.reset({ index: 0, routes: [{ name: 'ProjectList' }] }),
    );
    navigation.getParent<BottomTabNavigationProp<MainTabParamList>>()?.navigate('Overview');
  };

  const goToStep = (next: number) => {
    if (next === 2) {
      const reserve = (monthlyIncome * 6).toFixed(2);
      setEmergencyInput(reserve);
    }
    setStep(next);
  };

  const handleFinish = async () => {
    setError(null);
    try {
      await postSmartSetupMutation.mutateAsync({
        projectId,
        data: {
          annualIncome,
          date: dayjs().format('YYYY-MM-DD'),
          defaultCategories: categories.map((c) => ({
            id: c.id,
            name: c.name,
            percentage: parseFloat(c.percentageStr) || 0,
          })),
          emergencyReserveTarget: parseFloat(emergencyInput) || 0,
        },
      });
      navigateToOverview();
    } catch (err) {
      captureError(err, { screen: 'SmartSetupScreen', action: 'smartSetup' });
      setError(t('ErrorGeneric'));
    }
  };

  const updateCategoryPct = (id: string, pctStr: string) => {
    const pct = Math.min(100, Math.max(0, parseFloat(pctStr) || 0));
    setCategories((prev) =>
      prev.map((c) => (c.id === id ? { ...c, percentageStr: pctStr, percentage: pct } : c)),
    );
  };

  const updateCategoryName = (id: string, name: string) => {
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  };

  const removeCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  const addCategory = () => {
    const newId = `new-${Date.now()}`;
    setCategories((prev) => [
      ...prev,
      { id: newId, name: '', percentage: 0, percentageStr: '0' },
    ]);
  };

  const toggleBg = dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.52)';
  const toggleBorder = dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.86)';

  const percentageDiff = percentageTotal - 100;
  const percentageDiffAbs = Math.abs((percentageDiff * monthlyIncome) / 100);
  const percentageDiffFormatted = percentageDiffAbs.toFixed(2);

  const step1Valid = annualIncome > 0;
  // Allow any total ≤ 100% — only block when the user has over-allocated.
  const step2Valid = percentageDiff <= 0.5;

  // ─── Header ────────────────────────────────────────────────────────────────

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: hair }]}>
      <View style={styles.headerLeft}>
        {step > 0 && (
          <TouchableOpacity onPress={() => setStep((s) => s - 1)}>
            <Text style={[styles.headerAction, { color: ink2 }]}>{t('SmartSetupBack')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={[styles.headerTitle, { color: ink }]}>{t('SmartSetupTitle')}</Text>
      <TouchableOpacity onPress={navigateToOverview} style={styles.headerRight}>
        <Text style={[styles.headerAction, { color: colors.primary }]}>{t('SmartSetupSkip')}</Text>
      </TouchableOpacity>
    </View>
  );

  // ─── Progress bar ──────────────────────────────────────────────────────────

  const renderProgress = () => (
    <View style={[styles.progressRow, { paddingHorizontal: 20 }]}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          testID={`progress-step-${i}`}
          style={[
            styles.progressPill,
            { backgroundColor: colors.primary, opacity: i <= step ? 1 : 0.25 },
          ]}
        />
      ))}
    </View>
  );

  // ─── Step 1 ────────────────────────────────────────────────────────────────

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: ink }]}>{t('SmartSetupStep1Title')}</Text>
      <Text style={[styles.stepDescription, { color: ink2 }]}>
        {t('SmartSetupStep1Description')}
      </Text>
      <GlassCard dark={dark} radius={18} style={styles.heroCard}>
        <Pressable style={styles.incomeHero} onPress={() => annualIncomeInputRef.current?.focus()}>
          <Text style={[styles.heroLabel, { color: ink2 }]}>
            {t('SmartSetupStep1Title').toUpperCase()}
          </Text>
          <View style={styles.heroRow}>
            <Text testID="FieldAnnualIncome-prefix" style={[styles.heroSym, { color: colors.primary }]}>
              {getCurrencySymbol(currency)}
            </Text>
            <Text testID="income-hero-int" style={[styles.heroInt, { color: ink }]}>
              {incomeIntStr}
            </Text>
            <Text testID="income-hero-dec" style={[styles.heroDec, { color: ink2 }]}>
              {incomeDecStr}
            </Text>
          </View>
          <TextInput
            ref={annualIncomeInputRef}
            testID="FieldAnnualIncome"
            value={annualIncomeStr}
            onChangeText={setAnnualIncomeStr}
            keyboardType="decimal-pad"
            caretHidden
            accessible={false}
            importantForAccessibility="no"
            style={styles.hiddenInput}
          />
        </Pressable>
      </GlassCard>
      <AuroraPrimaryButton
        testID={t('SmartSetupNext')}
        label={t('SmartSetupNext')}
        onPress={() => goToStep(1)}
        disabled={!step1Valid}
        icon="arrow-right"
      />
    </View>
  );

  // ─── Step 2 ────────────────────────────────────────────────────────────────

  const renderStep2 = () => {
    let footerColor: string;
    let footerMessage: string;

    if (percentageDiff > 0.5) {
      footerColor = colors.error;
      footerMessage = t('SmartSetupPercentageExceeded', {
        amount: percentageDiffFormatted,
      });
    } else if (percentageDiff < -0.5) {
      footerColor = customColors.warning;
      footerMessage = t('SmartSetupPercentageRemaining', {
        amount: percentageDiffFormatted,
      });
    } else {
      footerColor = customColors.success;
      footerMessage = t('FullDistribution');
    }

    return (
      <View style={styles.stepContent}>
        <Text style={[styles.stepTitle, { color: ink }]}>{t('SmartSetupStep2Title')}</Text>
        <Text style={[styles.stepDescription, { color: ink2 }]}>
          {t('SmartSetupStep2Description')}
        </Text>

        {categories.map((cat, index) => {
          const monthly = (monthlyIncome * (parseFloat(cat.percentageStr) || 0)) / 100;
          return (
            <GlassCard key={cat.id || String(index)} dark={dark} radius={18} style={styles.categoryCard}>
              {/* Name + delete row */}
              <View style={styles.categoryNameRow}>
                <View style={styles.categoryNameField}>
                  <AuroraField
                    dark={dark}
                    testID={`${cat.id}-name`}
                    placeholder={t('SmartSetupCategoryNamePlaceholder')}
                    value={cat.name}
                    onChangeText={(v) => updateCategoryName(cat.id, v)}
                  />
                </View>
                <TouchableOpacity
                  testID={`${cat.id}-delete`}
                  onPress={() => removeCategory(cat.id)}
                  style={styles.deleteBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <MaterialCommunityIcons name="close-circle" size={20} color={colors.error} />
                </TouchableOpacity>
              </View>

              {/* Slider + percentage input row */}
              <View style={styles.sliderRow}>
                <CategorySlider
                  testID={`${cat.id}-pct-slider`}
                  value={cat.percentage}
                  onValueChange={(v) => updateCategoryPct(cat.id, String(v))}
                  fillColor={colors.primary}
                  trackColor={dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)'}
                />
                <View style={styles.pctInputWrapper}>
                  <AuroraField
                    dark={dark}
                    textPrefix="%"
                    placeholder="0"
                    testID={`${cat.id}-pct`}
                    value={cat.percentageStr}
                    onChangeText={(v) => updateCategoryPct(cat.id, v)}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <Text style={[styles.monthlyPreview, { color: ink2 }]}>
                {t('SmartSetupMonthlyBudgetPreview', { amount: monthly.toFixed(2) })}
              </Text>
            </GlassCard>
          );
        })}

        {/* Add category */}
        <TouchableOpacity
          testID="add-category-btn"
          style={[styles.addCategoryBtn, { borderColor: colors.primary }]}
          onPress={addCategory}
        >
          <MaterialCommunityIcons name="plus" size={16} color={colors.primary} />
          <Text style={[styles.addCategoryLabel, { color: colors.primary }]}>
            {t('SmartSetupAddCategory')}
          </Text>
        </TouchableOpacity>

        {/* Sticky footer total */}
        <View style={[styles.totalRow, { backgroundColor: toggleBg, borderColor: toggleBorder }]}>
          <Text style={[styles.totalLabel, { color: ink }]}>{t('Total')}</Text>
          <Text style={[styles.totalValue, { color: footerColor }]}>
            {percentageTotal.toFixed(1)}% — {footerMessage}
          </Text>
        </View>

        <AuroraPrimaryButton
          testID={t('SmartSetupNext')}
          label={t('SmartSetupNext')}
          onPress={() => goToStep(2)}
          disabled={!step2Valid}
          icon="arrow-right"
        />
      </View>
    );
  };

  // ─── Step 3 ────────────────────────────────────────────────────────────────

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={[styles.stepTitle, { color: ink }]}>{t('SmartSetupStep3Title')}</Text>
      <Text style={[styles.stepDescription, { color: ink2 }]}>
        {t('SmartSetupStep3Description')}
      </Text>
      <GlassCard dark={dark} radius={18} style={styles.heroCard}>
        <Pressable style={styles.incomeHero} onPress={() => emergencyInputRef.current?.focus()}>
          <Text style={[styles.heroLabel, { color: ink2 }]}>
            {t('SmartSetupEmergencyReserveLabel').toUpperCase()}
          </Text>
          <View style={styles.heroRow}>
            <Text style={[styles.heroSym, { color: colors.primary }]}>
              {getCurrencySymbol(currency)}
            </Text>
            <Text testID="reserve-hero-int" style={[styles.heroInt, { color: ink }]}>
              {reserveIntStr}
            </Text>
            <Text testID="reserve-hero-dec" style={[styles.heroDec, { color: ink2 }]}>
              {reserveDecStr}
            </Text>
          </View>
          <TextInput
            ref={emergencyInputRef}
            testID="SmartSetupEmergencyReserveLabel"
            value={emergencyInput}
            onChangeText={setEmergencyInput}
            keyboardType="decimal-pad"
            caretHidden
            accessible={false}
            importantForAccessibility="no"
            style={styles.hiddenInput}
          />
        </Pressable>
      </GlassCard>
      <Text style={[styles.hint, { color: ink2 }]}>{t('SmartSetupEmergencyReserveHint')}</Text>

      <ErrorBanner
        visible={!!error}
        message={error ?? undefined}
        onDismiss={() => setError(null)}
      />

      <AuroraPrimaryButton
        testID={t('SmartSetupFinish')}
        label={t('SmartSetupFinish')}
        onPress={handleFinish}
        loading={postSmartSetupMutation.isPending}
        icon="check"
      />
    </View>
  );

  return (
    <GlassScreen dark={dark}>
      {renderHeader()}
      {renderProgress()}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {step === 0 && renderStep1()}
          {step === 1 && renderStep2()}
          {step === 2 && renderStep3()}
        </ScrollView>
      </KeyboardAvoidingView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '700' },
  headerRight: { flex: 1, alignItems: 'flex-end' },
  headerAction: { fontSize: 14, fontWeight: '600' },
  progressRow: { flexDirection: 'row', gap: 6, paddingVertical: 12 },
  progressPill: { flex: 1, height: 4, borderRadius: 2 },
  scroll: { flexGrow: 1, paddingHorizontal: 20 },
  stepContent: { gap: 12, paddingTop: 4 },
  stepTitle: { fontSize: 20, fontWeight: '800', marginBottom: 2 },
  stepDescription: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  heroCard: { padding: 0 },
  incomeHero: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 16 },
  heroLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.9, marginBottom: 10 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  heroSym: { fontSize: 22, fontWeight: '600', paddingBottom: 10 },
  heroInt: { fontSize: 48, fontWeight: '800', letterSpacing: -1 },
  heroDec: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5, paddingBottom: 10 },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  categoryCard: { padding: 14, gap: 8 },
  categoryNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryNameField: { flex: 1 },
  deleteBtn: { padding: 2 },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pctInputWrapper: { width: 90 },
  addCategoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addCategoryLabel: { fontSize: 13, fontWeight: '600' },
  monthlyPreview: { fontSize: 12, marginTop: 2 },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginVertical: 4,
  },
  totalLabel: { fontSize: 14, fontWeight: '700' },
  totalValue: { fontSize: 13, fontWeight: '600' },
  hint: { fontSize: 12, marginTop: 4 },
});
