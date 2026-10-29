type RawErrorResponse = { response?: { data?: { errors?: Record<string, string[]> } } };

export function extractApiErrors(error: unknown): Record<string, string[]> {
  const e = error as RawErrorResponse;
  return e?.response?.data?.errors ?? {};
}

/**
 * Whether the API refused an upload because the file's *content* did not match what it
 * declared. The server keys that rejection to `contentType`, and the response is a 400 -
 * a retry of the same file would fail identically, so callers should explain the problem
 * rather than suggest trying again.
 */
export function isAttachmentContentRejection(error: unknown): boolean {
  const e = error as RawErrorResponse & { response?: { status?: number } };
  if (e?.response?.status !== 400) {
    return false;
  }

  const messages = extractApiErrors(error).contentType;
  return Array.isArray(messages) && messages.length > 0;
}
