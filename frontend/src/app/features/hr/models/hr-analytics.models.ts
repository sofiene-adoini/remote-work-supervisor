export interface AnalyticsEmployee {
  userId: number;
  fullName: string;
  email: string;
  employeeId: string | null;
  phone: string | null;
  jobTitle: string | null;
  roleName: string;
  employmentStatus: 'active' | 'suspended' | 'terminated';
  startDate: string | null;
  expectedDailyHours: number | null;
  agentRequired: boolean;
  memberSince: string | null;
  team: { id: number; name: string } | null;
  projects: { id: number; name: string }[];
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
  lastSeenAt: string | null;
  agentDevice: {
    id: number;
    deviceId: string;
    deviceName: string;
    operatingSystem: string;
    agentVersion: string;
    lastSeenAt: string | null;
    pairedAt: string | null;
  } | null;
  breakViolations: number;
  daysPresent: number;
  longestDayHours: number;
}

export interface EmployeeListSummary {
  total: number;
  activeNow: number;
  onBreak: number;
  clockedOut: number;
  agentOnline: number;
  suspended: number;
  terminated: number;
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
  employee: {
    id: number;
    fullName: string;
    email: string;
    employeeId: string | null;
    phone: string | null;
    jobTitle: string | null;
    roleName: string;
    employmentStatus: 'active' | 'suspended' | 'terminated';
    startDate: string | null;
    expectedDailyHours: number | null;
    agentRequired: boolean;
    isActive: boolean;
    memberSince: string | null;
    team: { id: number; name: string } | null;
    projects: { id: number; name: string }[];
    agentDevice: {
      id: number;
      deviceId: string;
      deviceName: string;
      operatingSystem: string;
      agentVersion: string;
      lastSeenAt: string | null;
      pairedAt: string | null;
    } | null;
    lastSeenAt: string | null;
    agentOnline: boolean;
  };
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
  breaks: { start: string; end: string | null; minutes: number; isAutomatic: boolean; reason: string | null }[];
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
  summary: EmployeeListSummary;
}
