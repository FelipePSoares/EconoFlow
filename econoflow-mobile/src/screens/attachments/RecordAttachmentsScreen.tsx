import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OverviewStackParamList } from '../../navigation/OverviewStackNavigator';
import type { Attachment } from '../../api/types';
import type { UploadFile } from '../../api/attachments.api';
import { getIncomeAttachmentUrl, getExpenseAttachmentUrl } from '../../api/attachments.api';
import { useProjectStore } from '../../store/projectStore';
import {
  useAddExpenseAttachment,
  useAddIncomeAttachment,
  useDeleteExpenseAttachment,
  useDeleteIncomeAttachment,
  useExpense,
  useIncome,
} from '../../hooks/useAttachments';
import { AttachmentSection } from '../../components/attachments/AttachmentSection';
import { AttachmentPickerSheet } from '../../components/attachments/AttachmentPickerSheet';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { ErrorBanner } from '../../components/common/ErrorBanner';
import { LoadingIndicator } from '../../components/common/LoadingIndicator';
import { captureError } from '../../monitoring/sentry';
import { downloadAndOpenAttachment } from '../../utils/attachmentDownload';
import type { AttachmentValidationError } from '../../utils/attachments';

type Props = NativeStackScreenProps<OverviewStackParamList, 'RecordAttachments'>;

export const RecordAttachmentsScreen: React.FC<Props> = ({ route }) => {
  const { t } = useTranslation();
  const { kind, id, categoryId, month } = route.params;
  const { selectedProject } = useProjectStore();
  const projectId = selectedProject?.project.id ?? '';
  const canEdit = selectedProject?.role !== 'Viewer';

  const isIncome = kind === 'income';
  const category = categoryId ?? '';

  // Both queries are always called (rules of hooks); the unused one is disabled.
  const incomeQuery = useIncome(projectId, isIncome ? id : '');
  const expenseQuery = useExpense(projectId, isIncome ? '' : category, isIncome ? '' : id);
  const recordQuery = isIncome ? incomeQuery : expenseQuery;

  const incomeRecord = incomeQuery?.data;
  const expenseRecord = expenseQuery?.data;
  const attachments: Attachment[] = isIncome
    ? incomeRecord?.attachments ?? []
    : expenseRecord?.attachments ?? [];

  const addIncome = useAddIncomeAttachment(projectId, id, month);
  const deleteIncome = useDeleteIncomeAttachment(projectId, id, month);
  const addExpense = useAddExpenseAttachment(projectId, category, id, month);
  const deleteExpense = useDeleteExpenseAttachment(projectId, category, id, month);
  const addAttachment = isIncome ? addIncome : addExpense;
  const deleteAttachment = isIncome ? deleteIncome : deleteExpense;

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);

  const queryError = recordQuery?.isError ? recordQuery.error : undefined;

  useEffect(() => {
    if (queryError) {
      captureError(queryError, { screen: 'RecordAttachmentsScreen', action: 'fetchRecord' });
    }
  }, [queryError]);

  const urlFor = (attachmentId: string) =>
    isIncome
      ? getIncomeAttachmentUrl(projectId, id, attachmentId)
      : getExpenseAttachmentUrl(projectId, category, id, attachmentId);

  const handleAdd = () => setPickerVisible(true);

  const handleInvalidFile = (error: AttachmentValidationError) => {
    setPickerVisible(false);
    setErrorMessage(
      error === 'tooLarge'
        ? t('AttachmentFileSizeExceeded')
        : t('AttachmentInvalidFileType')
    );
  };

  const handleSelect = (file: UploadFile) => {
    setPickerVisible(false);
    setErrorMessage(undefined);
    addAttachment.mutate(file, {
      onError: (error: unknown) => {
        captureError(error, { screen: 'RecordAttachmentsScreen', action: 'uploadAttachment' });
        setErrorMessage(t('AttachmentUploadFailed'));
      },
    });
  };

  const handleOpen = async (attachment: Attachment) => {
    try {
      await downloadAndOpenAttachment(
        urlFor(attachment.id),
        attachment.name,
        attachment.contentType
      );
    } catch (error) {
      captureError(error, { screen: 'RecordAttachmentsScreen', action: 'openAttachment' });
      setErrorMessage(t('AttachmentOpenFailed'));
    }
  };

  const handleConfirmDelete = () => {
    const attachment = pendingDelete;
    setPendingDelete(null);

    if (!attachment) {
      return;
    }

    deleteAttachment.mutate(attachment.id, {
      onError: (error: unknown) => {
        captureError(error, { screen: 'RecordAttachmentsScreen', action: 'deleteAttachment' });
        setErrorMessage(t('AttachmentDeleteFailed'));
      },
    });
  };

  const isLoading = recordQuery?.isLoading ?? false;
  const loadFailed = recordQuery?.isError ?? false;

  return (
    <View style={styles.container} testID="record-attachments-screen">
      <ErrorBanner
        visible={!!errorMessage || loadFailed}
        message={errorMessage ?? t('ErrorGeneric')}
        onDismiss={() => setErrorMessage(undefined)}
      />

      {isLoading ? (
        <LoadingIndicator />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.title}>{route.params.title}</Text>

          <AttachmentSection
            attachments={attachments}
            canEdit={canEdit}
            isUploading={addAttachment.isPending}
            onAddPress={handleAdd}
            onOpenPress={handleOpen}
            onDeletePress={setPendingDelete}
          />
        </ScrollView>
      )}

      <AttachmentPickerSheet
        visible={pickerVisible}
        onDismiss={() => setPickerVisible(false)}
        onSelect={handleSelect}
        onInvalidFile={handleInvalidFile}
      />

      <ConfirmDialog
        visible={pendingDelete !== null}
        title={t('Attachments')}
        message={t('ConfirmDeleteAttachment')}
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, gap: 14 },
  title: { fontSize: 18, fontWeight: '800' },
});
