export interface ApiErrorResponse {
  errors: Record<string, string[]>;
  requiresCaptcha?: boolean;
}
