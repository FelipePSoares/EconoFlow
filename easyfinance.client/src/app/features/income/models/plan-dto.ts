import { PlanType } from 'src/app/core/enums/plan-type';
import { Plan } from 'src/app/core/models/plan';

export class PlanDto {
  id!: string;
  projectId!: string;
  type!: PlanType;
  name!: string;
  targetAmount!: number;
  currentBalance!: number;
  remaining!: number;
  progress!: number;
  isArchived!: boolean;

  static fromPlan(plan: Plan): PlanDto {
    const dto = new PlanDto();
    dto.id = plan.id;
    dto.projectId = plan.projectId;
    dto.type = plan.type;
    dto.name = plan.name;
    dto.targetAmount = Number(plan.targetAmount || 0);
    dto.currentBalance = Number(plan.currentBalance || 0);
    dto.remaining = Number(plan.remaining || 0);
    dto.progress = Number(plan.progress || 0);
    dto.isArchived = !!plan.isArchived;
    return dto;
  }

  static fromPlans(plans: Plan[]): PlanDto[] {
    return plans.map(plan => PlanDto.fromPlan(plan));
  }
}
