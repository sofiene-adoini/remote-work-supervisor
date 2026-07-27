export interface AnalyticsEmployee {
  userId: number;
  fullName: string;
  email: string;
  team: { id: number; name: string } | null;
  workedHours: number;
  expectedHours: number;
  missingHours: number;
  overtimeHours: number;
  breakHours: number;
  attendancePct: number;
  evaluation: 'excellent' | 'good' | 'acceptable' | 'underworked' | 'absent' | 'overtime' | 'day_off';
  currentStatus: 'active' | 'break' | 'clocked_out';
  agentOnline: boolean;
  lastActivity: string | null;
  breakViolations: number;
  daysPresent: number;
  longestDayHours: number;
}

export interface AnalyticsSummary {
  totalEmployees: number;
  totalWorkedHours: number;
  totalBreakHours: number;
  totalOvertimeHours: number;
  totalMissingHours: number;
  absentDays: number;
  overtimeDays: number;
  breakViolations: number;
  averageAttendancePct: number;
  workingDaysInRange: number;
}

export interface EmployeeDetailSummary {
  employee: { id: number; fullName: string; email: string; team: { id: number; name: string } | null };
  summary: {
    workedHours: number;
    expectedHours: number;
    missingHours: number;
    overtimeHours: number;
    breakHours: number;
    averageDailyHours: number;
    longestDayHours: number;
    longestBreakMinutes: number;
    breakViolations: number;
    suspiciousScreenshotCount: number;
    autoBreakCount: number;
    manualBreakCount: number;
    daysPresent: number;
    workingDaysInRange: number;
  };
}

export interface TimelineEntry {
  date: string;
  dayOfWeek: string;
  isWorkingDay: boolean;
  clockIn: string | null;
  clockOut: string | null;
  breaks: { start: string; end: string | null; minutes: number }[];
  workedMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  attendance: string;
  alerts: { id: number; type: string; title: string; severity: string; message: string }[];
  screenshotCount: number;
  suspiciousCount: number;
}

export interface ChartData {
  dailyData: { date: string; workedHours: number; overtimeHours: number; breakHours: number; activeEmployees: number }[];
  topProductive: { userId: number; name: string; workedHours: number; overtimeHours: number }[];
  topOvertime: { userId: number; name: string; workedHours: number; overtimeHours: number }[];
}

export interface PaginatedEmployees {
  employees: AnalyticsEmployee[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}
