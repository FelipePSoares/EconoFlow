import React, { useState } from 'react';
import {
  ScrollView, StyleSheet, TouchableOpacity, View, FlatList,
} from 'react-native';
import { Text, TextInput, HelperText, Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import { useProjectStore } from '../../store/projectStore';
import { useCreateCategory } from '../../hooks/useCategories';
import { useDefaultCategories } from '../../hooks/useSmartSetup';
import { captureError } from '../../monitoring/sentry';
import { useAuroraSkin } from '../../theme/useAuroraSkin';
import { GlassScreen } from '../../components/common/GlassScreen';
import { ErrorBanner } from '../../components/common/ErrorBanner';

type Props = NativeStackScreenProps<OverviewStackParamList, 'AddCategory'>;

interface FormValues {
  name: string;
}

export const AddCategoryScreen: React.FC<Props> = ({ route, navigation }) => {
  const { t } = useTranslation();
  const { dark, ink, ink2 } = useAuroraSkin();
  const { month } = route.params;
  const { selectedProject } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';
  const [apiError, setApiError] = useState<string | null>(null);
  const [nameInput, setNameInput] = useState('');

  const createCategory = useCreateCategory(projectId, month);
  const { data: defaultCategories } = useDefaultCategories(projectId);

  const suggestionNames = (defaultCategories ?? []).map((c) => c.name);

  const { control, handleSubmit, formState: { errors }, setValue } = useForm<FormValues>({
    defaultValues: { name: '' },
  });

  const filteredSuggestions = !nameInput ? [] : suggestionNames.filter((n) =>
    n.toLowerCase().includes(nameInput.toLowerCase()),
  );

  const onSubmit = (values: FormValues) => {
    setApiError(null);
    createCategory.mutate(
      { name: values.name.trim() },
      {
        onSuccess: () => navigation.goBack(),
        onError: (error) => {
          captureError(error, { screen: 'AddCategoryScreen', action: 'createCategory' });
          setApiError(t('ErrorGeneric'));
        },
      },
    );
  };

  const isMutating = createCategory.isPending;

  return (
    <GlassScreen dark={dark}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.backBtn, { borderColor: dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)' }]}
            activeOpacity={0.7}
            testID="add-category-back-btn"
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={ink} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: ink }]}>{t('CreateExpenseCategory')}</Text>
          <View style={styles.backBtn} />
        </View>

        {/* ── Error banner ────────────────────────────────────────────── */}
        {apiError && (
          <ErrorBanner
            visible
            message={apiError}
            onDismiss={() => setApiError(null)}
          />
        )}

        {/* ── Name field ──────────────────────────────────────────────── */}
        <Controller
          control={control}
          name="name"
          rules={{
            required: t('RequiredField'),
            maxLength: { value: 100, message: t('PropertyMaxLength', { field: t('FieldCategoryName'), max: 100 }) },
          }}
          render={({ field: { onChange, value } }) => (
            <TextInput
              label={t('FieldCategoryName')}
              placeholder={t('FieldCategoryName')}
              value={value}
              onChangeText={(text) => {
                onChange(text);
                setNameInput(text);
              }}
              style={styles.input}
              error={!!errors.name}
              mode="outlined"
            />
          )}
        />
        {errors.name && <HelperText type="error" style={styles.helper}>{errors.name.message}</HelperText>}

        {/* ── Suggestions ─────────────────────────────────────────────── */}
        {filteredSuggestions.length > 0 && (
          <View style={[styles.suggestionsCard, { backgroundColor: dark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.68)' }]}>
            <FlatList
              data={filteredSuggestions}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.suggestionItem}
                  onPress={() => setValue('name', item, { shouldValidate: true })}
                  activeOpacity={0.6}
                >
                  <MaterialCommunityIcons name="shape-outline" size={18} color={ink2} />
                  <Text style={[styles.suggestionText, { color: ink }]}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* ── Submit button ───────────────────────────────────────────── */}
        <Button
          mode="contained"
          onPress={handleSubmit(onSubmit)}
          loading={isMutating}
          disabled={isMutating}
          style={styles.submitBtn}
          contentStyle={styles.submitContent}
          testID="add-category-submit"
        >
          {t('ButtonCreate')}
        </Button>
      </ScrollView>
    </GlassScreen>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 28,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 12,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
    borderColor: 'transparent',
  },
  title: {
    fontSize: 17, fontWeight: '800', textAlign: 'center',
  },
  input: {
    marginTop: 4,
  },
  helper: {
    marginBottom: 4,
  },
  suggestionsCard: {
    borderRadius: 16,
    marginTop: 8,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  suggestionText: {
    fontSize: 14.5,
    fontWeight: '500',
  },
  submitBtn: {
    marginTop: 28,
    borderRadius: 17,
  },
  submitContent: {
    height: 52,
  },
});
