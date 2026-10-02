import type { UploadFile } from '../api/attachments.api';

/** Mirrors `AttachmentUploadPolicy.MaxAttachmentSizeBytes` on the backend. */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

/** Mirrors `AttachmentUploadPolicy` allowed content types on the backend. */
export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const;

export type AttachmentValidationError = 'invalidType' | 'tooLarge';

interface ValidatableAsset {
  mimeType?: string | null;
  size?: number | null;
}

/**
 * Client-side guard mirroring the server policy. A missing size is accepted
 * because the backend remains the authority and still rejects oversized files.
 */
export function validateAttachment(asset: ValidatableAsset): AttachmentValidationError | null {
  if (!asset.mimeType || !ALLOWED_ATTACHMENT_MIME_TYPES.includes(asset.mimeType as never)) {
    return 'invalidType';
  }

  if (asset.size != null && asset.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return 'tooLarge';
  }

  return null;
}

export function attachmentNameFromUri(uri: string): string {
  const withoutQuery = uri.split('?')[0];
  const segments = withoutQuery.split('/');
  const last = segments[segments.length - 1];

  return last && last.length > 0 ? last : 'attachment';
}

export function toUploadFile(asset: {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
}): UploadFile {
  return {
    uri: asset.uri,
    name: asset.name && asset.name.length > 0 ? asset.name : attachmentNameFromUri(asset.uri),
    type: asset.mimeType && asset.mimeType.length > 0 ? asset.mimeType : 'application/octet-stream',
  };
}
