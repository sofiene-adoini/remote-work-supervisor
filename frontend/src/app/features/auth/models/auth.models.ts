export interface AuthRole {
  id: number;
  name: 'Employee' | 'Manager' | 'HR' | 'Admin' | string;
  type?: string;
}

export interface AuthTeam {
  id: number;
  name: string;
}

export interface CurrentUser {
  id: number;
  fullName: string;
  email: string;
  role: AuthRole | null;
  team: AuthTeam | null;
  isActive: boolean;
}

export interface AuthResponse {
  jwt: string;
  user?: CurrentUser;
}

export interface InviteRequest {
  email: string;
  fullName: string;
  roleId: number;
  teamId?: number | null;
}
