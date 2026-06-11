export interface LoginFailureResponse {
  code: string;
  requiresTwoFactor: boolean;
  requiresCaptcha: boolean;
}

export interface MobileLoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  twoFactorCode?: string;
  twoFactorRecoveryCode?: string;
  captchaToken?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  enabled: boolean;
  isFirstLogin: boolean;
  emailConfirmed: boolean;
  twoFactorEnabled: boolean;
  defaultProjectId: string | null;
  notificationChannels: string[];
  languageCode: string;
  isBetaTester: boolean;
}

export interface Project {
  id: string;
  name: string;
  preferredCurrency: string;
  isArchived: boolean;
}

export interface UserProject {
  id: string;
  userId: string;
  project: Project;
  userName: string;
  userEmail: string;
  role: 'Viewer' | 'Manager' | 'Admin';
  accepted: boolean;
}

export interface Category {
  id: string;
  name: string;
  isArchived: boolean;
  displayOrder: number;
  expenses: Expense[];
  totalBudget: number;
  totalWaste: number;
}

export interface Expense {
  id: string;
  name: string;
  date: string;
  amount: number;
  budget: number;
  isDeductible: boolean;
  attachments: ExpenseAttachment[];
  items: ExpenseItem[];
}

export interface ExpenseItem {
  id: string;
  name: string;
  date: string;
  amount: number;
  isDeductible: boolean;
  attachments: ExpenseAttachment[];
}

export interface ExpenseAttachment {
  id: string;
  name: string;
  contentType: string;
  size: number;
}

export interface Income {
  id: string;
  name: string;
  date: string;
  amount: number;
}

export interface PatchOperation {
  op: 'replace' | 'add' | 'remove';
  path: string;
  value?: unknown;
}

export interface CreateProjectRequest {
  name: string;
  preferredCurrency: string;
}

export interface CreateCategoryRequest {
  name: string;
}

export interface CreateExpenseRequest {
  name: string;
  date: string;
  amount: number;
  budget: number;
  isDeductible: boolean;
}

export interface CreateIncomeRequest {
  name: string;
  date: string;
  amount: number;
}

export interface Plan {
  id: string;
  projectId: string;
  type: string;
  name: string;
  targetAmount: number;
  currentBalance: number;
  remaining: number;
  progress: number;
  isArchived: boolean;
}

export interface PlanEntry {
  id: string;
  planId: string;
  date: string;
  amountSigned: number;
  note: string;
}

export interface CreatePlanRequest {
  type: 'Savings' | 'EmergencyReserve';
  name: string;
  targetAmount: number;
}

export interface CreatePlanEntryRequest {
  date: string;
  amountSigned: number;
  note?: string;
}

export interface CreateExpenseItemRequest {
  name: string;
  date: string;
  amount: number;
}

export interface TaxYearSettingsRequest {
  taxYearType: 'CalendarYear' | 'CustomStartMonth';
  taxYearStartMonth?: number;
  taxYearStartDay?: number;
  taxYearLabeling?: 'ByStartYear' | 'ByEndYear';
}

export interface DefaultCategory {
  // Backend DTO (CategoryWithPercentageDTO) has no Id field; absent in real responses.
  id?: string;
  name: string;
  percentage: number;
}

export interface SmartSetupRequest {
  annualIncome: number;
  date: string;
  defaultCategories: DefaultCategory[];
  emergencyReserveTarget: number;
}

export interface ManageInfoRequest {
  oldPassword?: string;
  newPassword?: string;
  newEmail?: string;
}

export interface TwoFactorSetupInfo {
  isTwoFactorEnabled: boolean;
  sharedKey: string;
  otpAuthUri: string;
}

export interface EnableTwoFactorRequest {
  code: string;
}

export interface EnableTwoFactorResponse {
  twoFactorEnabled: boolean;
  recoveryCodes: string[];
}

export interface DisableTwoFactorRequest {
  password: string;
  twoFactorCode?: string;
  twoFactorRecoveryCode?: string;
}

export interface AppNotification {
  id: string;
  codeMessage: string;
  actionLabelCode: string;
  type: string;
  category: string;
  isActionRequired: boolean;
  isSticky: boolean;
  metadata: string;
}
