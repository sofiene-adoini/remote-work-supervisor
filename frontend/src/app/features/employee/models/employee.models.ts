export interface Session {
  id: number;
  clockIn: string;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  status: 'active' | 'break' | 'completed';
  totalBreakMinutes: number;
  user?: { id: number; fullName: string };
}

export interface DailyStats {
  workedMinutes: number;
  productiveMinutes: number;
  idleMinutes: number;
  breakMinutes: number;
  overtimeMinutes: number;
  expectedMinutes: number;
  missingMinutes: number;
  extraMinutes: number;
  attendanceStatus: 'completed' | 'underworked' | 'overtime' | 'absent' | 'day_off';
}

export interface WeeklyStats {
  expectedHours: number;
  workedHours: number;
  overtimeHours: number;
  missingHours: number;
  productiveHours: number;
  idleHours: number;
  breakHours: number;
  attendanceRate: number;
  completionRate: number;
}

export interface MonthlyStats {
  expectedHours: number;
  workedHours: number;
  overtimeHours: number;
  missingHours: number;
  averageDailyHours: number;
  attendancePercentage: number;
  productivePercentage: number;
}

export interface SessionResponse {
  status: 'clocked_out' | 'active' | 'break';
  sessionId: number | null;
  clockIn: string | null;
  clockOut: string | null;
  breakStartedAt: string | null;
  totalBreakMinutes: number;
  workedTodayMinutes: number;
  weeklyMinutes: number;
  currentProject: { id: number; name: string } | null;
  agentOnline: boolean;
  dailyStats: DailyStats;
  weeklyStats: WeeklyStats;
}

export interface WeeklyHoursResponse {
  hoursByDay: Record<string, number>;
  days: string[];
}

export interface Project {
  id: number;
  name: string;
  description?: string;
  status: 'active' | 'archived';
  hoursLogged?: number;
  hoursThisWeek?: number;
  hoursTotal?: number;
  createdAt: string;
}

export interface TimeEntry {
  id: number;
  date: string;
  hours: number;
  description?: string;
  project?: Project;
  user?: { id: number; fullName: string };
  createdAt: string;
}

export interface Alert {
  id: number;
  type: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  isRead: boolean;
  createdAt: string;
  user?: { id: number; fullName?: string };
  session?: { id: number } | null;
}

export interface OvertimeDeclaration {
  id: number;
  date: string;
  hours: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  user?: { id: number; fullName: string };
  createdAt: string;
}

export interface HrStats {
  activeNow: number;
  onBreak: number;
  idleFlagged: number;
  totalHoursToday: number;
}

export interface SessionWithWorked extends Session {
  workedMinutes: number;
}

export interface SessionHistoryResponse {
  sessions: SessionWithWorked[];
}

export interface TodayDetailResponse {
  sessions: SessionWithWorked[];
  totalWorkedMinutes: number;
  totalBreakMinutes: number;
}

export interface TeamMember {
  id: number;
  fullName: string;
  email: string;
  role: string;
  status: 'active' | 'break' | 'idle' | 'clocked_out';
  currentProject?: string;
  hoursToday: number;
  hoursThisWeek: number;
  lastActivity?: string;
}

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

export interface EmployeeWorkStats {
  userId: number;
  fullName: string;
  email: string;
  dailyStats: DailyStats;
  weeklyStats: WeeklyStats;
  attendanceEvaluation: string;
  currentSession: {
    status: string;
    clockIn: string;
    durationMinutes: number;
  } | null;
}
