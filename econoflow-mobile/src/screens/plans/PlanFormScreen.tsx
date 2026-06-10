import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PlansStackParamList } from '../../navigation/PlansStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { usePlans, useCreatePlan } from '../../hooks/usePlans';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';
import { extractApiErrors } from '../../utils/apiErrors';
import * as PlansApi from '../../api/plans.api';
import { buildPatch } from '../../utils/patch';

type PlanType = 'Savings' | 'EmergencyReserve';

type Props = NativeStackScreenProps<PlansStackParamList, 'PlanForm'>;

export const PlanFormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { selectedProject } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';
  const { planId, initialValues } = route.params;
  const isEdit = !!planId;

  const [selectedType, setSelectedType] = useState<PlanType>(
    (initialValues?.type as PlanType) ?? 'Savings',
  );
  const [name, setName] = useState(initialValues?.name ?? '');
  const [targetAmount, setTargetAmount] = useState(
    initialValues?.targetAmount?.toString() ?? '',
  );
  const [nameError, setNameError] = useState<string | undefined>();
  const [targetError, setTargetError] = useState<string | undefined>();
  const [apiError, setApiError] = useState<string | undefined>();
  const [isPending, setIsPending] = useState(false);

  const { data: plans } = usePlans(projectId);
  const createPlan = useCreatePlan(projectId);

  const hasEmergencyReserve = (plans ?? []).some(
    (p) => p.type === 'EmergencyReserve' && !p.isArchived && p.id !== planId,
  );

  const clearErrors = () => {
    setNameError(undefined);
    setTargetError(undefined);
    setApiError(undefined);
  };

  const handleApiError = (error: unknown) => {
    const fieldErrors = extractApiErrors(error);
    const unmapped: string[] = [];
    clearErrors();
    for (const [key, messages] of Object.entries(fieldErrors)) {
      const first = messages[0];
      switch (key.toLowerCase()) {
        case 'name':
          setNameError(first);
          break;
        case 'targetamount':
          setTargetError(first);
          break;
        default:
          unmapped.push(first);
      }
    }
    if (unmapped.length > 0) {
      setApiError(unmapped.join(' '));
    } else if (Object.keys(fieldErrors).length === 0) {
      setApiError(t('ErrorGeneric') ?? 'Something went wrong.');
    }
  };

  const onSave = async () => {
    clearErrors();

    if (!name.trim()) {
      setNameError(t('RequiredField') ?? 'Required');
      return;
    }
    const amount = parseFloat(targetAmount);
    if (!targetAmount || isNaN(amount) || amount <= 0) {
      setTargetError(t('ValueShouldBeGreaterThan', { value: 0 }) ?? 'Must be > 0');
      return;
    }

    setIsPending(true);
    try {
      if (isEdit && planId) {
        const ops = buildPatch({ name: name.trim(), targetAmount: amount } as Record<string, unknown>);
        await PlansApi.patchPlan(projectId, planId, ops);
        navigation.goBack();
      } else {
        await new Promise<void>((resolve, reject) => {
          createPlan.mutate(
            { type: selectedType, name: name.trim(), targetAmount: amount },
            { onSuccess: () => resolve(), onError: (err) => reject(err) },
          );
        });
        navigation.goBack();
      }
    } catch (err) {
      handleApiError(err);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <GlassScreen dark={dark}>
      {/* ── Header ───────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerBtn, { borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)' }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={ink} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: ink }]}>
          {isEdit ? t('EditPlan') : t('CreatePlan')}
        </Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <ErrorBanner
          visible={!!apiError}
          message={apiError}
          onDismiss={() => setApiError(undefined)}
        />

        <GlassCard dark={!!dark} radius={18} intensity={30} style={styles.card}>
          <View style={styles.cardInner}>

            {/* ── Type toggle ────────────────────────────────────────── */}
            {!isEdit && (
              <View style={styles.section}>
                <Text style={[styles.label, { color: ink2 }]}>{t('PlanType')}</Text>
                <View style={styles.toggleRow}>
                  <TouchableOpacity
                    style={[
                      styles.togglePill,
                      selectedType === 'Savings' && { backgroundColor: colors.primary + '22', borderColor: colors.primary },
                      selectedType !== 'Savings' && { borderColor: ink2 + '44' },
                    ]}
                    onPress={() => setSelectedType('Savings')}
                    activeOpacity={0.8}
                  >
                    <Text style={[
                      styles.toggleText,
                      { color: selectedType === 'Savings' ? colors.primary : ink2 },
                    ]}>
                      {t('PlanTypeSaving')}
                    </Text>
                  </TouchableOpacity>

                  {!hasEmergencyReserve && (
                    <TouchableOpacity
                      style={[
                        styles.togglePill,
                        selectedType === 'EmergencyReserve' && { backgroundColor: colors.error + '22', borderColor: colors.error },
                        selectedType !== 'EmergencyReserve' && { borderColor: ink2 + '44' },
                      ]}
                      onPress={() => setSelectedType('EmergencyReserve')}
                      activeOpacity={0.8}
                    >
                      <Text style={[
                        styles.toggleText,
                        { color: selectedType === 'EmergencyReserve' ? colors.error : ink2 },
                      ]}>
                        {t('PlanTypeEmergencyReserve')}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* ── Name field ─────────────────────────────────────────── */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: ink2 }]}>{t('PlanName')}</Text>
              <AuroraField
                placeholder={t('PlanName')}
                value={name}
                onChangeText={setName}
                dark={!!dark}
                hasError={!!nameError}
              />
              {nameError && <Text style={[styles.errorText, { color: '#e74c3c' }]}>{nameError}</Text>}
            </View>

            {/* ── Target amount field ────────────────────────────────── */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: ink2 }]}>{t('PlanTargetAmount')}</Text>
              <AuroraField
                placeholder="0"
                value={targetAmount}
                onChangeText={setTargetAmount}
                keyboardType="decimal-pad"
                dark={!!dark}
                hasError={!!targetError}
              />
              {targetError && <Text style={[styles.errorText, { color: '#e74c3c' }]}>{targetError}</Text>}
            </View>
          </View>
        </GlassCard>

        <AuroraPrimaryButton
          label={t('ButtonSave')}
          onPress={onSave}
          loading={isPending}
          disabled={isPending}
        />
      </ScrollView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  headerBtn: {
    width: 38, height: 38, borderRadius: 12,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    borderColor: 'transparent',
  },
  content: { padding: 16, gap: 16 },
  card: { marginBottom: 8 },
  cardInner: { padding: 16, gap: 12 },
  section: { gap: 6 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldGroup: { gap: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  errorText: { fontSize: 12, marginTop: 2 },
  toggleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  togglePill: {
    borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 7,
  },
  toggleText: { fontSize: 13, fontWeight: '600' },
});
