import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, HelperText, Text, TextInput } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useCreateIncome, usePatchIncome } from '../../hooks/useIncomes';
import { toDateOnly, fromDateOnly, currentMonth } from '../../utils/date';
import { buildPatch } from '../../utils/patch';
import { captureError } from '../../monitoring/sentry';

type Props = NativeStackScreenProps<OverviewStackParamList, 'IncomeForm'>;

interface FormValues {
  name: string;
  amount: string;
}

export const IncomeFormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { incomeId, initialValues, month = currentMonth() } = route.params;
  const { selectedProject } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';
  const isEdit = !!incomeId;

  const [date, setDate] = useState<Date>(
    initialValues?.date ? fromDateOnly(initialValues.date) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);

  const createIncome = useCreateIncome(projectId, month);
  const patchIncome = usePatchIncome(projectId, incomeId ?? '', month);

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: initialValues?.name ?? '',
      amount: initialValues?.amount?.toString() ?? '',
    },
  });

  const onSubmit = (values: FormValues) => {
    const parsed = {
      name: values.name,
      amount: parseFloat(values.amount) || 0,
      date: toDateOnly(date),
    };

    if (isEdit) {
      patchIncome.mutate(buildPatch(parsed as Record<string, unknown>), {
        onSuccess: () => navigation.goBack(),
        onError: (error) => captureError(error, { screen: 'IncomeFormScreen', action: 'updateIncome' }),
      });
    } else {
      createIncome.mutate(parsed, {
        onSuccess: () => navigation.goBack(),
        onError: (error) => captureError(error, { screen: 'IncomeFormScreen', action: 'createIncome' }),
      });
    }
  };

  const isMutating = createIncome.isPending || patchIncome.isPending;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        {isEdit ? (t('LabelEditIncome') ?? 'Edit income') : (t('LabelAddIncome') ?? 'Add income')}
      </Text>

      <Controller
        control={control}
        name="name"
        rules={{ required: t('RequiredField') ?? 'Required' }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            label={t('FieldName') ?? 'Name'}
            value={value}
            onChangeText={onChange}
            style={styles.input}
            error={!!errors.name}
          />
        )}
      />
      {errors.name && <HelperText type="error">{errors.name.message}</HelperText>}

      <Controller
        control={control}
        name="amount"
        rules={{
          required: t('RequiredField') ?? 'Required',
          min: { value: 0, message: t('ValueShouldBeGreaterThanOrEqual', { value: 0 }) ?? 'Value must be ≥ 0.' },
        }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            label={t('FieldAmount') ?? 'Amount'}
            value={value}
            onChangeText={onChange}
            keyboardType="decimal-pad"
            style={styles.input}
            error={!!errors.amount}
          />
        )}
      />
      {errors.amount && <HelperText type="error">{errors.amount.message}</HelperText>}

      <Button mode="outlined" onPress={() => setShowDatePicker(true)} style={styles.input}>
        {t('FieldDate') ?? 'Date'}: {toDateOnly(date)}
      </Button>
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

      <Button
        mode="contained"
        onPress={handleSubmit(onSubmit)}
        loading={isMutating}
        disabled={isMutating}
        style={styles.button}
      >
        {isEdit ? (t('ButtonSave') ?? 'Save') : (t('ButtonAdd') ?? 'Add')}
      </Button>
      <Button mode="text" onPress={() => navigation.goBack()} style={styles.link}>
        {t('ButtonCancel') ?? 'Cancel'}
      </Button>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, gap: 4 },
  title: { marginBottom: 16, fontWeight: 'bold' },
  input: { marginBottom: 4 },
  button: { marginTop: 16 },
  link: { marginTop: 4 },
});
