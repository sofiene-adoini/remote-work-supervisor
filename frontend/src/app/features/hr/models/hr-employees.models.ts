export interface HrRole {
  id: number;
  name: string;
  type: string;
}

export interface EmployeeDeviceInfo {
  id: number;
  deviceId: string;
  deviceName: string;
  operatingSystem: string;
  agentVersion: string;
  lastSeenAt: string | null;
  pairedAt: string | null;
}

export interface EmployeeProfile {
  id: number;
  fullName: string;
  email: string;
  employeeId: string | null;
  phone: string | null;
  jobTitle: string | null;
  role: { id: number; name: string; type: string } | null;
  roleName: string;
  employmentStatus: 'active' | 'suspended' | 'terminated';
  startDate: string | null;
  expectedDailyHours: number | null;
  agentRequired: boolean;
  isActive: boolean;
  memberSince: string | null;
  team: { id: number; name: string } | null;
  projects: { id: number; name: string }[];
  agentDevice: EmployeeDeviceInfo | null;
  lastSeenAt: string | null;
}

export interface EmployeeBreakRow {
  id: number;
  start: string;
  end: string | null;
  duration: number;
  isAuto: boolean;
  reason: string | null;
  session?: { id: number; clockIn: string; clockOut: string | null };
}

export interface EmployeeSessionRow {
  id: number;
  clockIn: string;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  status: string;
  totalBreakMinutes: number;
  workedMinutes: number;
  breaks: {
    id: number;
    start: string;
    end: string | null;
    duration: number;
    isAuto: boolean;
    reason: string | null;
  }[];
}

export interface InviteEmployeePayload {
  email: string;
  fullName: string;
  roleId: number;
  teamId?: number | null;
  phone?: string | null;
  jobTitle?: string | null;
  employeeId?: string | null;
  startDate?: string | null;
  expectedDailyHours?: number | null;
  agentRequired?: boolean;
  employmentStatus?: string;
  password?: string;
  sendWelcomeEmail?: boolean;
}

export interface UpdateEmployeePayload {
  fullName?: string;
  email?: string;
  phone?: string | null;
  jobTitle?: string | null;
  employeeId?: string | null;
  teamId?: number | null;
  roleId?: number;
  employmentStatus?: 'active' | 'suspended' | 'terminated';
  startDate?: string | null;
  expectedDailyHours?: number | null;
  agentRequired?: boolean;
}
