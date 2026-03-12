import { PlanType } from '../enums/plan-type';

export class Plan {
  id!: string;
  projectId!: string;
  type!: PlanType;
  name!: string;
  targetAmount!: number;
  currentBalance!: number;
  remaining!: number;
  progress!: number;
  isArchived!: boolean;
}

export interface PlanRequest {
  type: PlanType;
  name: string;
  targetAmount: number;
}
