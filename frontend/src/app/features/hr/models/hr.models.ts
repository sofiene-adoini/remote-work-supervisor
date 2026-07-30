export interface HrDashboardStats {
  totalEmployees: number;
  activeNow: number;
  onBreak: number;
  clockedOut: number;
  idleFlagged: number;
  totalHoursToday: number;
  pendingOvertime: number;
  unreadAlerts: number;
}

export interface HrTeam {
  id: number;
  name: string;
  description: string | null;
  leader: { id: number; fullName: string; email: string } | null;
  memberCount: number;
  activeMemberCount: number;
  projectCount: number;
  createdAt: string | null;
}

export interface HrTeamMember {
  id: number;
  fullName: string;
  email: string;
  status: 'active' | 'break' | 'idle' | 'clocked_out';
  hoursToday: number;
  isLeader?: boolean;
  team?: { id: number; name: string } | null;
}

export interface HrOvertimeDeclaration {
  id: number;
  date: string;
  workedMinutes: number;
  expectedMinutes: number;
  overtimeMinutes: number;
  reason?: string;
  notes?: string;
  status: 'detected' | 'submitted' | 'pending' | 'approved' | 'rejected' | 'cancelled';
  justificationSubmittedAt?: string;
  reviewedAt?: string;
  user?: { id: number; fullName: string; email: string };
  session?: { id: number; clockIn: string; clockOut: string };
  reviewer?: { id: number; fullName: string } | null;
  createdAt: string;
}

export interface HrAlert {
  id: number;
  type: string;
  title: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  isRead: boolean;
  user?: { id: number; fullName?: string };
  session?: { id: number } | null;
  createdAt: string;
}

export interface HrUnassignedEmployee {
  id: number;
  fullName: string;
  email: string;
  roleName: string;
}

export interface HrTeamDetail {
  id: number;
  name: string;
  description: string | null;
  leader: { id: number; fullName: string; email: string } | null;
  memberCount: number;
  projectCount: number;
  projects: { id: number; name: string }[];
  members: HrTeamMember[];
  createdAt: string | null;
}

export interface HrProject {
  id: number;
  name: string;
  description: string;
  status: 'planning' | 'active' | 'on_hold' | 'completed' | 'cancelled' | 'archived';
  priority?: 'low' | 'medium' | 'high' | 'critical';
  client?: string;
  expectedStart?: string;
  expectedEnd?: string;
  estimatedHours?: number;
  color?: string;
  manager?: { id: number; fullName: string } | null;
  team?: { id: number; name: string } | null;
  users: { id: number; fullName: string }[];
  totalHours?: number;
  activeHoursThisWeek?: number;
  createdAt: string;
}

export interface HrEmployeeStats {
  userId: number;
  fullName: string;
  email: string;
  dailyStats: {
    workedMinutes: number;
    expectedMinutes: number;
    overtimeMinutes: number;
    missingMinutes: number;
    breakMinutes: number;
    attendanceStatus: string;
  };
  weeklyStats: {
    expectedHours: number;
    workedHours: number;
    overtimeHours: number;
    missingHours: number;
    attendanceRate: number;
    completionRate: number;
  };
  attendanceEvaluation: string;
  currentSession: {
    status: string;
    clockIn: string;
    durationMinutes: number;
  } | null;
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
  minimumOvertimeThresholdMinutes: number;
  requireHrApproval: boolean;
  requireJustification: boolean;
  allowClockInOutsideSchedule: boolean;
  allowWeekendWork: boolean;
  workingDays: string[];
  lateToleranceMinutes: number;
  earlyLeaveToleranceMinutes: number;
  maximumContinuousWorkHours: number;
  timezone: string;
}
