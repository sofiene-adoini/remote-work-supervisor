import type { Context } from 'koa';
import { WorkPolicyService } from '../services/work-policy.service';

export default {
  async find(ctx: Context) {
    const policy = await WorkPolicyService.get();
    return ctx.send({ policy });
  },

  async update(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const roleName = ctx.state.user?.role?.name;
    if (roleName !== 'HR' && roleName !== 'Admin') {
      return ctx.forbidden('HR or Admin role required');
    }

    const data = ctx.request.body as Record<string, any>;

    const allowedFields = [
      'expectedDailyHours', 'expectedWeeklyHours', 'maximumDailyHours', 'maximumWeeklyHours',
      'minimumBreakMinutes', 'autoOvertimeEnabled', 'overtimeStartsAfterDailyHours',
      'minimumOvertimeThresholdMinutes', 'requireHrApproval', 'requireJustification',
      'allowClockInOutsideSchedule', 'allowWeekendWork', 'workingDays',
      'lateToleranceMinutes', 'earlyLeaveToleranceMinutes',
      'maximumContinuousWorkHours', 'timezone',
    ];

    const sanitized: Record<string, any> = {};
    for (const key of allowedFields) {
      if (data[key] !== undefined) {
        sanitized[key] = data[key];
      }
    }

    if (Object.keys(sanitized).length === 0) {
      return ctx.badRequest('No valid fields provided');
    }

    const updated = await WorkPolicyService.update(sanitized);
    return ctx.send({ policy: updated });
  },
};
