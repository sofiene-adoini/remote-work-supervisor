const POLICY_UID = 'api::company-work-policy.company-work-policy';

export interface CompanyWorkPolicy {
  id?: number;
  expectedDailyHours: number;
  expectedWeeklyHours: number;
  maximumDailyHours: number;
  maximumWeeklyHours: number;
  minimumBreakMinutes: number;
  autoOvertimeEnabled: boolean;
  overtimeStartsAfterDailyHours: number;
  allowClockInOutsideSchedule: boolean;
  allowWeekendWork: boolean;
  workingDays: string[];
  lateToleranceMinutes: number;
  earlyLeaveToleranceMinutes: number;
  maximumContinuousWorkHours: number;
  timezone: string;
}

const DEFAULT_POLICY: CompanyWorkPolicy = {
  expectedDailyHours: 8,
  expectedWeeklyHours: 40,
  maximumDailyHours: 12,
  maximumWeeklyHours: 60,
  minimumBreakMinutes: 30,
  autoOvertimeEnabled: true,
  overtimeStartsAfterDailyHours: 8,
  allowClockInOutsideSchedule: true,
  allowWeekendWork: false,
  workingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  lateToleranceMinutes: 5,
  earlyLeaveToleranceMinutes: 5,
  maximumContinuousWorkHours: 6,
  timezone: 'Africa/Tunis',
};

let cachedPolicy: CompanyWorkPolicy | null = null;

export const WorkPolicyService = {
  async get(): Promise<CompanyWorkPolicy> {
    if (cachedPolicy) {
      const c = cachedPolicy;
      return c;
    }

    const row = await strapi.db.query(POLICY_UID).findOne({ where: { id: 1 } });
    if (row) {
      const policy = { ...DEFAULT_POLICY, ...row } as CompanyWorkPolicy;
      cachedPolicy = policy;
      return policy;
    }

    return DEFAULT_POLICY;
  },

  async update(data: Partial<CompanyWorkPolicy>): Promise<CompanyWorkPolicy> {
    const existing = await strapi.db.query(POLICY_UID).findOne({ where: { id: 1 } });

    if (existing) {
      await strapi.db.query(POLICY_UID).update({
        where: { id: existing.id },
        data,
      });
    } else {
      await strapi.db.query(POLICY_UID).create({
        data: { id: 1, ...data },
      });
    }

    cachedPolicy = null;
    return (await this.get())!;
  },

  invalidateCache(): void {
    cachedPolicy = null;
  },

  expectedDailyMinutes(): number {
    return (cachedPolicy ?? DEFAULT_POLICY).expectedDailyHours * 60;
  },

  expectedWeeklyMinutes(): number {
    return (cachedPolicy ?? DEFAULT_POLICY).expectedWeeklyHours * 60;
  },

  overtimeThresholdMinutes(): number {
    return (cachedPolicy ?? DEFAULT_POLICY).overtimeStartsAfterDailyHours * 60;
  },

  maxContinuousMinutes(): number {
    return (cachedPolicy ?? DEFAULT_POLICY).maximumContinuousWorkHours * 60;
  },

  isWorkingDay(date: Date): boolean {
    const policy = cachedPolicy ?? DEFAULT_POLICY;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return policy.workingDays.includes(dayNames[date.getDay()]);
  },
};
