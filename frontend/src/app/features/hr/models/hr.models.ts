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
  status: 'active' | 'break' | 'idle' | 'clocked_out';
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
  users: { id: number; fullName: string; email: string }[];
}

export interface HrProject {
  id: number;
  name: string;
  description: string;
  status: string;
  team?: { id: number; name: string } | null;
  users: { id: number; fullName: string }[];
  createdAt: string;
}
