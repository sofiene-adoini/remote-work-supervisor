export interface AgentDevice {
  id: number;
  deviceId: string;
  deviceName: string;
  hostname: string;
  operatingSystem: string;
  agentVersion: string;
  pairedAt: string;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  trustExpiresAt: string;
  lastIPAddress: string | null;
  active: boolean;
  revoked: boolean;
  revokedAt: string | null;
  revokedBy: string | null;
  logoutAt: string | null;
  employee?: { id: number; fullName?: string; email?: string };
}

export interface PairingCodeResponse {
  code: string;
  expiresAt: string;
}

export interface PairResponse {
  jwt: string;
  deviceId: string;
  trustExpiresAt: string;
}

export interface DeviceListResponse {
  devices: AgentDevice[];
}
