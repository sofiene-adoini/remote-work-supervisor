const ALERT_UID = 'api::alert.alert';
const USER_UID = 'plugin::users-permissions.user';

export type AlertType =
  | 'idle_detected'
  | 'suspicious_activity'
  | 'clock_in'
  | 'clock_out'
  | 'break_started'
  | 'break_ended'
  | 'agent_offline'
  | 'agent_online';

export type AlertSeverity = 'info' | 'warning' | 'critical';

interface CreateAlertParams {
  type: AlertType;
  title?: string;
  message: string;
  severity: AlertSeverity;
  userId: number;
  sessionId?: number;
}

const TITLE_MAP: Record<AlertType, string> = {
  idle_detected: 'Idle Detected',
  suspicious_activity: 'Suspicious Activity',
  clock_in: 'Clocked In',
  clock_out: 'Clocked Out',
  break_started: 'Break Started',
  break_ended: 'Break Ended',
  agent_offline: 'Agent Offline',
  agent_online: 'Agent Online',
};

export async function createAndEmit(params: CreateAlertParams) {
  const { type, title, message, severity, userId, sessionId } = params;

  const alert = await strapi.db.query(ALERT_UID).create({
    data: {
      type,
      title: title || TITLE_MAP[type],
      message,
      severity,
      isRead: false,
      user: userId,
      session: sessionId || null,
    },
  });

  const io = (strapi as any).io;
  if (!io) {
    strapi.log.warn(`[Notification] Socket.IO not available — alert ${alert.id} persisted but not emitted`);
    return alert;
  }

  const user = await strapi.db.query(USER_UID).findOne({
    where: { id: userId },
    select: ['id', 'fullName'],
  });

  const payload = {
    id: alert.id,
    type: alert.type,
    title: alert.title,
    message: alert.message,
    severity: alert.severity,
    isRead: false,
    createdAt: alert.createdAt,
    user: user ? { id: user.id, fullName: user.fullName } : { id: userId },
    session: sessionId ? { id: sessionId } : null,
  };

  io.to(`employee:${userId}`).emit('alert:created', payload);
  io.to('hr').emit('alert:created', payload);
  io.to('admin').emit('alert:created', payload);

  strapi.log.info(`[Notification] alert:created type=${type} userId=${userId} severity=${severity}`);

  return alert;
}
