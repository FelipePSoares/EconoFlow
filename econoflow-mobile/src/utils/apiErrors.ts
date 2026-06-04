type RawErrorResponse = { response?: { data?: { errors?: Record<string, string[]> } } };

export function extractApiErrors(error: unknown): Record<string, string[]> {
  const e = error as RawErrorResponse;
  return e?.response?.data?.errors ?? {};
}
