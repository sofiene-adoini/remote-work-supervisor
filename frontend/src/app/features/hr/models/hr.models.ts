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
  memberCount: number;
}

export interface HrTeamMember {
  id: number;
  fullName: string;
  email: string;
  status: 'active' | 'break' | 'clocked_out';
  hoursToday: number;
  team?: { id: number; name: string } | null;
}

export interface HrOvertimeDeclaration {
  id: number;
  date: string;
  hours: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  user?: { id: number; fullName: string; email: string };
  createdAt: string;
}

export interface HrAlert {
  id: number;
  type: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  message: string;
  read: boolean;
  user?: { id: number; fullName: string };
  createdAt: string;
}
