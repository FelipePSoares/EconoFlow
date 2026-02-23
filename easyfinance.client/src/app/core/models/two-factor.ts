export interface TwoFactorSetupResponse {
  isTwoFactorEnabled: boolean;
  sharedKey: string;
  otpAuthUri: string;
}

export interface TwoFactorEnableResponse {
  twoFactorEnabled: boolean;
  recoveryCodes: string[];
}

export interface TwoFactorStatusResponse {
  twoFactorEnabled: boolean;
}

export interface TwoFactorRecoveryCodesResponse {
  recoveryCodes: string[];
}

export interface TwoFactorSecureActionRequest {
  password: string;
  twoFactorCode?: string;
  twoFactorRecoveryCode?: string;
}
