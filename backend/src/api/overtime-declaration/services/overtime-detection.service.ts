import { WorkPolicyService } from '../../company-work-policy/services/work-policy.service';
import { TimeCalculationService } from '../../company-work-policy/services/time-calculation.service';
import { createAndEmit } from '../../alert/services/notification.service';

const OT_UID = 'api::overtime-declaration.overtime-declaration';
const SESSION_UID = 'api::session.session';

function getUserId(ot: any): number {
  return typeof ot.user === 'object' ? ot.user.id : ot.user;
}

function emitOvertimeDetected(ot: any) {
  const io = (strapi as any).io;
  if (!io) return;

  const uid = getUserId(ot);
  const payload = { overtimeId: ot.id, userId: uid, status: ot.status, overtimeMinutes: ot.overtimeMinutes };

  io.to('hr').emit('overtime:detected', payload);
  io.to('admin').emit('overtime:detected', payload);
  io.to(`employee:${uid}`).emit('overtime:detected', payload);
  io.to(`user:${uid}`).emit('overtime:detected', payload);
}

function emitOvertimeStatusChanged(ot: any) {
  const io = (strapi as any).io;
  if (!io) return;

  const uid = getUserId(ot);
  const payload = { overtimeId: ot.id, userId: uid, status: ot.status, overtimeMinutes: ot.overtimeMinutes };

  io.to('hr').emit('overtime:status-changed', payload);
  io.to('admin').emit('overtime:status-changed', payload);
  io.to(`employee:${uid}`).emit('overtime:status-changed', payload);
  io.to(`user:${uid}`).emit('overtime:status-changed', payload);
}

export const OvertimeDetectionService = {
  async detectAfterClockOut(userId: number, sessionId: number) {
    const policy = await WorkPolicyService.get();
    if (!policy.autoOvertimeEnabled) return null;

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const session = await strapi.db.query(SESSION_UID).findOne({
      where: { id: sessionId },
    });
    if (!session || !session.clockOut) return null;

    const allTodaySessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: userId,
        clockIn: { $gte: today.toISOString(), $lt: todayEnd.toISOString() },
      },
    });

    let totalWorkedMinutes = 0;
    for (const s of allTodaySessions) {
      totalWorkedMinutes += TimeCalculationService.computeWorkedMinutes(s, now);
    }

    const expectedMinutes = policy.expectedDailyHours * 60;
    const overtimeMinutes = totalWorkedMinutes - expectedMinutes;

    if (overtimeMinutes <= policy.minimumOvertimeThresholdMinutes) return null;

    const existingToday = await strapi.db.query(OT_UID).findOne({
      where: { user: userId, date: today.toISOString().slice(0, 10) },
    });
    if (existingToday) return existingToday;

    const ot = await strapi.db.query(OT_UID).create({
      data: {
        date: today.toISOString().slice(0, 10),
        workedMinutes: totalWorkedMinutes,
        expectedMinutes,
        overtimeMinutes,
        status: 'detected',
        user: userId,
        session: sessionId,
      },
    });

    const populatedOt = await strapi.db.query(OT_UID).findOne({
      where: { id: ot.id },
      populate: ['user', 'session'],
    });

    emitOvertimeDetected(populatedOt);

    createAndEmit({
      type: 'overtime_detected',
      title: 'Overtime Detected',
      message: `The system detected ${Math.round(overtimeMinutes / 60 * 10) / 10}h of overtime for today.`,
      severity: 'warning',
      userId,
      sessionId,
    }).catch(() => {});

    createAndEmit({
      type: 'overtime_detected',
      title: 'Overtime Detected',
      message: `System detected ${Math.round(overtimeMinutes / 60 * 10) / 10}h overtime for employee.`,
      severity: 'info',
      userId,
      sessionId,
    }).catch(() => {});

    strapi.log.info(`[Overtime] Detected ${overtimeMinutes}min OT for user=${userId}`);

    return populatedOt;
  },

  emitOvertimeStatusChanged,
};
