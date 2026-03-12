import { PlanType } from 'src/app/core/enums/plan-type';
import { PlanDto } from './plan-dto';

export class PlanPatchModel {
  id?: string;
  type!: PlanType;
  name!: string;
  targetAmount!: number;

  static fromPlan(plan: PlanDto): PlanPatchModel {
    const model = new PlanPatchModel();
    model.id = plan.id;
    model.type = plan.type;
    model.name = plan.name ?? '';
    model.targetAmount = Number(plan.targetAmount || 0);
    return model;
  }
}
