import { ApiErrorResponse } from '../models/error';

/**
 * Whether the server refused an upload because the file's *content* did not match what the
 * client declared. The backend keys every content rejection to `contentType` — a mismatch
 * between the declared and detected type, or content matching no supported type at all.
 *
 * A retry of the same file would fail identically, so upload surfaces should explain the
 * problem instead of suggesting the user try again.
 */
export function isAttachmentContentRejection(error: ApiErrorResponse | null | undefined): boolean {
  const messages = error?.errors?.['contentType'];

  return Array.isArray(messages) && messages.length > 0;
}
