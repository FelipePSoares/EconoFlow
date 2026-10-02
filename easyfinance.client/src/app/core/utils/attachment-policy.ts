/**
 * Client-side mirror of the backend `AttachmentUploadPolicy`
 * (EasyFinance.Application/Features/AttachmentService/AttachmentUploadPolicy.cs).
 *
 * Every attachment upload surface in the web app — expense, expense item and income —
 * must validate through this module so the limit and the allow-list live in one place.
 * The backend remains the authority: it re-validates every upload.
 */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const ALLOWED_ATTACHMENT_MIME_TYPES: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
];

/**
 * `accept` attribute for the file inputs. PDF is offered by extension because some
 * systems report it as `application/octet-stream`; the rest are the allowed image types.
 */
export const ATTACHMENT_ACCEPT_ATTRIBUTE =
  ['.pdf', ...ALLOWED_ATTACHMENT_MIME_TYPES.filter(contentType => contentType !== 'application/pdf')].join(',');

export type AttachmentRejection = 'invalidType' | 'tooLarge';

/** Mirrors the backend's `StringComparer.OrdinalIgnoreCase` comparison. */
export function isAllowedAttachmentContentType(contentType: string | null | undefined): boolean {
  if (!contentType || contentType.trim().length === 0) {
    return false;
  }

  const normalized = contentType.trim().toLowerCase();

  return ALLOWED_ATTACHMENT_MIME_TYPES.some(allowed => allowed.toLowerCase() === normalized);
}

/**
 * Returns the rejection reason for a selected file, or `null` when it may be uploaded.
 * An unknown size is accepted because the server still enforces the limit.
 *
 * Deliberate difference from the backend: a zero-byte file passes here. The server rejects it
 * (`AttachmentFileIsEmpty`) and the upload surfaces that rejection as a failed-upload message,
 * so the extra client branch would only duplicate an error the user already sees.
 */
export function validateAttachmentFile(file: { type?: string | null; size?: number | null }): AttachmentRejection | null {
  if (!isAllowedAttachmentContentType(file.type)) {
    return 'invalidType';
  }

  if (file.size != null && file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return 'tooLarge';
  }

  return null;
}
