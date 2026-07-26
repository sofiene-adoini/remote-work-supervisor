import { WorkPolicyService } from '../../company-work-policy/services/work-policy.service';
import { DailyStats, AttendanceEvaluation } from '../../company-work-policy/services/time-calculation.service';

export const AttendanceEvaluator = {
  async evaluate(userId: number, date: Date, dailyStats: DailyStats): Promise<AttendanceEvaluation> {
    const policy = await WorkPolicyService.get();

    if (!WorkPolicyService.isWorkingDay(date)) {
      return dailyStats.workedMinutes > 0 ? 'good' : 'weekend';
    }

    if (dailyStats.workedMinutes === 0 && dailyStats.attendanceStatus === 'absent') {
      return 'absent';
    }

    if (dailyStats.breakMinutes < policy.minimumBreakMinutes && dailyStats.workedMinutes >= policy.expectedDailyHours * 60 * 0.5) {
      return 'break_violation';
    }

    if (dailyStats.overtimeMinutes > 0) {
      return 'overtime';
    }

    const ratio = dailyStats.expectedMinutes > 0
      ? dailyStats.workedMinutes / dailyStats.expectedMinutes
      : 0;

    if (ratio >= 1.0) return 'excellent';
    if (ratio >= 0.9) return 'good';
    if (ratio >= 0.75) return 'acceptable';
    return 'underworked';
  },
};
