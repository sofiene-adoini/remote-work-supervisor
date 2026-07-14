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

export interface SessionResponse {
  status: 'clocked_out' | 'active' | 'break';
  session: Session | null;
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
  severity: 'info' | 'warning' | 'error' | 'success';
  message: string;
  read: boolean;
  createdAt: string;
  user?: { id: number; fullName: string };
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
