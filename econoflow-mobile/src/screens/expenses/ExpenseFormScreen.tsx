import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Checkbox, HelperText, Text, TextInput } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useCreateExpense, usePatchExpense } from '../../hooks/useExpenses';
import { toDateOnly, fromDateOnly } from '../../utils/date';
import { buildPatch } from '../../utils/patch';
import { extractApiErrors } from '../../utils/apiErrors';
import { ErrorBanner } from '../../components/common/ErrorBanner';

type Props = NativeStackScreenProps<OverviewStackParamList, 'ExpenseForm'>;

interface FormValues {
  name: string;
  amount: string;
  budget: string;
  isDeductible: boolean;
}

export const ExpenseFormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { categoryId, month, expenseId, initialValues } = route.params;
  const { selectedProject } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';
  const isEdit = !!expenseId;

  const [date, setDate] = useState<Date>(
    initialValues?.date ? fromDateOnly(initialValues.date) : new Date()
  );
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateError, setDateError] = useState<string | undefined>();
  const [apiError, setApiError] = useState<string | undefined>();

  const createExpense = useCreateExpense(projectId, categoryId, month);
  const patchExpense = usePatchExpense(projectId, categoryId, expenseId ?? '', month);

  const { control, handleSubmit, setError, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: initialValues?.name ?? '',
      amount: initialValues?.amount?.toString() ?? '',
      budget: initialValues?.budget?.toString() ?? '',
      isDeductible: initialValues?.isDeductible ?? false,
    },
  });

  const handleApiError = (error: unknown) => {
    const fieldErrors = extractApiErrors(error);
    const unmapped: string[] = [];

    setDateError(undefined);
    setApiError(undefined);

    for (const [key, messages] of Object.entries(fieldErrors)) {
      const first = messages[0];
      switch (key.toLowerCase()) {
        case 'name':
          setError('name', { type: 'server', message: first });
          break;
        case 'amount':
          setError('amount', { type: 'server', message: first });
          break;
        case 'budget':
          setError('budget', { type: 'server', message: first });
          break;
        case 'date':
          setDateError(first);
          break;
        default:
          unmapped.push(first);
      }
    }

    if (unmapped.length > 0) {
      setApiError(unmapped.join(' '));
    } else if (Object.keys(fieldErrors).length === 0) {
      setApiError(t('ErrorGeneric') ?? 'Something went wrong. Please try again.');
    }
  };

  const onSubmit = (values: FormValues) => {
    setDateError(undefined);
    setApiError(undefined);

    const parsed = {
      name: values.name,
      amount: parseFloat(values.amount) || 0,
      budget: parseFloat(values.budget) || 0,
      isDeductible: values.isDeductible,
      date: toDateOnly(date),
    };

    if (isEdit) {
      patchExpense.mutate(buildPatch(parsed as Record<string, unknown>), {
        onSuccess: () => navigation.goBack(),
        onError: handleApiError,
      });
    } else {
      createExpense.mutate(parsed, {
        onSuccess: () => navigation.goBack(),
        onError: handleApiError,
      });
    }
  };

  const isMutating = createExpense.isPending || patchExpense.isPending;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ErrorBanner
        visible={!!apiError}
        message={apiError}
        onDismiss={() => setApiError(undefined)}
      />
      <Text variant="headlineSmall" style={styles.title}>
        {isEdit ? (t('LabelEditExpense') ?? 'Edit expense') : (t('LabelAddExpense') ?? 'Add expense')}
      </Text>

      <Controller
        control={control}
        name="name"
        rules={{ required: t('RequiredField') ?? 'Required' }}
        render={({ field: { onChange, value } }) => (
          <TextInput label={t('FieldName') ?? 'Name'} value={value} onChangeText={onChange} style={styles.input} error={!!errors.name} />
        )}
      />
      {errors.name && <HelperText type="error">{errors.name.message}</HelperText>}

      <Controller
        control={control}
        name="amount"
        render={({ field: { onChange, value } }) => (
          <TextInput label={t('FieldAmount') ?? 'Amount'} value={value} onChangeText={onChange} keyboardType="decimal-pad" style={styles.input} error={!!errors.amount} />
        )}
      />
      {errors.amount && <HelperText type="error">{errors.amount.message}</HelperText>}

      <Controller
        control={control}
        name="budget"
        render={({ field: { onChange, value } }) => (
          <TextInput label={t('FieldBudget') ?? 'Budget'} value={value} onChangeText={onChange} keyboardType="decimal-pad" style={styles.input} error={!!errors.budget} />
        )}
      />
      {errors.budget && <HelperText type="error">{errors.budget.message}</HelperText>}

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
            if (selected) {
              setDate(selected);
              setDateError(undefined);
            }
          }}
        />
      )}
      {dateError && <HelperText type="error">{dateError}</HelperText>}

      <Controller
        control={control}
        name="isDeductible"
        render={({ field: { onChange, value } }) => (
          <View style={styles.checkboxRow}>
            <Checkbox status={value ? 'checked' : 'unchecked'} onPress={() => onChange(!value)} />
            <Text onPress={() => onChange(!value)}>{t('FieldIsDeductible') ?? 'Tax deductible'}</Text>
          </View>
        )}
      />

      <Button mode="contained" onPress={handleSubmit(onSubmit)} loading={isMutating} disabled={isMutating} style={styles.button}>
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
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 8 },
  button: { marginTop: 16 },
  link: { marginTop: 4 },
});
