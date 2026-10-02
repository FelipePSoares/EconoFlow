import { apiClient } from './client';
import type { Attachment } from './types';

/** A local file selected by the user, ready to be uploaded as multipart/form-data. */
export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

const MULTIPART_CONFIG = { headers: { 'Content-Type': 'multipart/form-data' } };

const buildFormData = (file: UploadFile, attachmentType?: string): FormData => {
  const formData = new FormData();
  // React Native's FormData accepts { uri, name, type } objects for file parts.
  formData.append('file', { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);

  if (attachmentType) {
    formData.append('attachmentType', attachmentType);
  }

  return formData;
};

export const uploadIncomeAttachment = (projectId: string, incomeId: string, file: UploadFile) =>
  apiClient.post<Attachment>(
    `/api/Projects/${projectId}/Incomes/${incomeId}/attachments`,
    buildFormData(file),
    MULTIPART_CONFIG
  );

export const uploadExpenseAttachment = (
  projectId: string,
  categoryId: string,
  expenseId: string,
  file: UploadFile
) =>
  apiClient.post<Attachment>(
    `/api/Projects/${projectId}/Categories/${categoryId}/Expenses/${expenseId}/attachments`,
    buildFormData(file, 'DeductibleProof'),
    MULTIPART_CONFIG
  );

export const deleteIncomeAttachment = (projectId: string, incomeId: string, attachmentId: string) =>
  apiClient.delete(`/api/Projects/${projectId}/Incomes/${incomeId}/attachments/${attachmentId}`);

export const deleteExpenseAttachment = (
  projectId: string,
  categoryId: string,
  expenseId: string,
  attachmentId: string
) =>
  apiClient.delete(
    `/api/Projects/${projectId}/Categories/${categoryId}/Expenses/${expenseId}/attachments/${attachmentId}`
  );

export const getIncomeAttachmentUrl = (projectId: string, incomeId: string, attachmentId: string) =>
  `/api/Projects/${projectId}/Incomes/${incomeId}/attachments/${attachmentId}`;

export const getExpenseAttachmentUrl = (
  projectId: string,
  categoryId: string,
  expenseId: string,
  attachmentId: string
) =>
  `/api/Projects/${projectId}/Categories/${categoryId}/Expenses/${expenseId}/attachments/${attachmentId}`;
