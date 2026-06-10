import React, { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { PlansStackParamList } from '../../navigation/PlansStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useAddPlanEntry } from '../../hooks/usePlans';
import { GlassScreen } from '../../components/common/GlassScreen';
import { GlassCard } from '../../components/common/GlassCard';
import { AuroraField } from '../../components/auth/AuroraField';
import { AuroraPrimaryButton } from '../../components/auth/AuroraPrimaryButton';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { useAppTheme } from '../../theme/useAppTheme';
import { extractApiErrors } from '../../utils/apiErrors';
import { toDateOnly } from '../../utils/date';

type ActionType = 'deposit' | 'withdrawal';

type Props = NativeStackScreenProps<PlansStackParamList, 'PlanEntryForm'>;

export const PlanEntryFormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { customColors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { selectedProject } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';
  const { planId, planName } = route.params;

  const [action, setAction] = useState<ActionType>('deposit');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date>(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [amountError, setAmountError] = useState<string | undefined>();
  const [apiError, setApiError] = useState<string | undefined>();

  const addEntry = useAddPlanEntry(projectId, planId);

  const clearErrors = () => {
    setAmountError(undefined);
    setApiError(undefined);
  };

  const handleApiError = (error: unknown) => {
    const fieldErrors = extractApiErrors(error);
    const unmapped: string[] = [];
    clearErrors();
    for (const [key, messages] of Object.entries(fieldErrors)) {
      const first = messages[0];
      switch (key.toLowerCase()) {
        case 'amountsigned':
        case 'amount':
          setAmountError(first);
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

  const onSave = () => {
    clearErrors();
    const parsed = parseFloat(amount);
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setAmountError(t('ValueShouldBeGreaterThan', { value: 0 }) ?? 'Must be > 0');
      return;
    }
    const amountSigned = action === 'deposit' ? parsed : -parsed;
    addEntry.mutate(
      { date: toDateOnly(date), amountSigned, note: note.trim() || undefined },
      {
        onSuccess: () => navigation.goBack(),
        onError: handleApiError,
      },
    );
  };

  const depositSelected = action === 'deposit';
  const withdrawalSelected = action === 'withdrawal';

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
        <Text style={[styles.headerTitle, { color: ink }]}>{planName}</Text>
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

            {/* ── Action toggle ──────────────────────────────────────── */}
            <View style={styles.toggleRow}>
              <TouchableOpacity
                style={[
                  styles.togglePill,
                  depositSelected && { backgroundColor: customColors.income + '22', borderColor: customColors.income },
                  !depositSelected && { borderColor: ink2 + '44' },
                ]}
                onPress={() => setAction('deposit')}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, { color: depositSelected ? customColors.income : ink2 }]}>
                  {t('PlanActionAddMoney')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.togglePill,
                  withdrawalSelected && { backgroundColor: customColors.expense + '22', borderColor: customColors.expense },
                  !withdrawalSelected && { borderColor: ink2 + '44' },
                ]}
                onPress={() => setAction('withdrawal')}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, { color: withdrawalSelected ? customColors.expense : ink2 }]}>
                  {t('PlanActionRemoveMoney')}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── Amount field ───────────────────────────────────────── */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: ink2 }]}>{t('FieldAmount')}</Text>
              <AuroraField
                placeholder="0.00"
                value={amount}
                onChangeText={setAmount}
                keyboardType="decimal-pad"
                dark={!!dark}
                hasError={!!amountError}
              />
              {amountError && <Text style={[styles.errorText, { color: '#e74c3c' }]}>{amountError}</Text>}
            </View>

            {/* ── Date picker ────────────────────────────────────────── */}
            <View style={styles.dateRow}>
              <Text style={[styles.dateLabel, { color: ink2 }]}>{t('FieldDate')}</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={[styles.datePill, { borderColor: ink2 + '44' }]}
                activeOpacity={0.8}
              >
                <Text style={[styles.dateText, { color: ink }]}>{toDateOnly(date)}</Text>
                <MaterialCommunityIcons name="calendar" size={16} color={ink2} />
              </TouchableOpacity>
            </View>
            {showDatePicker && (
              <DateTimePicker
                value={date}
                mode="date"
                maximumDate={new Date()}
                onChange={(_e, selected) => {
                  setShowDatePicker(false);
                  if (selected) setDate(selected);
                }}
              />
            )}

            {/* ── Note field ─────────────────────────────────────────── */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: ink2 }]}>{t('PlanEntryNote')}</Text>
              <AuroraField
                placeholder={t('PlanEntryNotePlaceholder')}
                value={note}
                onChangeText={setNote}
                dark={!!dark}
              />
            </View>
          </View>
        </GlassCard>

        <AuroraPrimaryButton
          label={t('ButtonSave')}
          onPress={onSave}
          loading={addEntry.isPending}
          disabled={addEntry.isPending}
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
  fieldGroup: { gap: 2 },
  fieldLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  errorText: { fontSize: 12, marginTop: 2 },
  toggleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  togglePill: { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 7 },
  toggleText: { fontSize: 13, fontWeight: '600' },
  dateRow: { gap: 4 },
  dateLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  datePill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10,
  },
  dateText: { fontSize: 14 },
});
