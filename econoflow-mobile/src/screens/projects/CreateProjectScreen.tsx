import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Button, Text, TextInput, HelperText } from 'react-native-paper';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { ProjectStackParamList } from '../../navigation/ProjectStackNavigator';
import { useCreateProject } from '../../hooks/useProjects';
import { useProjectStore } from '../../store/projectStore';

type Props = {
  navigation: NativeStackNavigationProp<ProjectStackParamList, 'CreateProject'>;
};

interface FormValues {
  name: string;
  preferredCurrency: string;
}

const COMMON_CURRENCIES = ['EUR', 'USD', 'GBP', 'BRL', 'JPY', 'CAD', 'AUD', 'CHF'];

export const CreateProjectScreen: React.FC<Props> = ({ navigation }) => {
  const { t } = useTranslation();
  const createProject = useCreateProject();
  const { setSelectedProject } = useProjectStore();

  const { control, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: { name: '', preferredCurrency: 'EUR' },
  });

  const onSubmit = (values: FormValues) => {
    createProject.mutate(values, {
      onSuccess: (project) => {
        setSelectedProject(project);
        navigation.navigate('MonthlyOverview');
      },
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        {t('LabelNewProject') ?? 'New project'}
      </Text>

      <Controller
        control={control}
        name="name"
        rules={{ required: t('RequiredField') ?? 'Required' }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            label={t('FieldProjectName') ?? 'Project name'}
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
        name="preferredCurrency"
        rules={{ required: t('RequiredField') ?? 'Required' }}
        render={({ field: { onChange, value } }) => (
          <TextInput
            label={t('FieldCurrency') ?? 'Currency (ISO code)'}
            value={value}
            onChangeText={(text) => onChange(text.toUpperCase())}
            autoCapitalize="characters"
            maxLength={3}
            style={styles.input}
            error={!!errors.preferredCurrency}
          />
        )}
      />
      {errors.preferredCurrency && (
        <HelperText type="error">{errors.preferredCurrency.message}</HelperText>
      )}
      <HelperText type="info">
        {t('LabelCommonCurrencies') ?? `Common: ${COMMON_CURRENCIES.join(', ')}`}
      </HelperText>

      <Button
        mode="contained"
        onPress={handleSubmit(onSubmit)}
        loading={createProject.isPending}
        disabled={createProject.isPending}
        style={styles.button}
      >
        {t('ButtonCreate') ?? 'Create'}
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
