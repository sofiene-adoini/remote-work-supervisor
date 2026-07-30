import { WorkPolicyService } from '../../company-work-policy/services/work-policy.service';
import { TimeCalculationService } from '../../company-work-policy/services/time-calculation.service';
import { createAndEmit } from '../../alert/services/notification.service';

const OT_UID = 'api::overtime-declaration.overtime-declaration';
const SESSION_UID = 'api::session.session';

function getLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

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
    if (!policy.autoOvertimeEnabled) {
      strapi.log.info(`[Overtime] Skipped — autoOvertimeEnabled is false for user=${userId}`);
      return null;
    }

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayEnd = new Date(today);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const session = await strapi.db.query(SESSION_UID).findOne({
      where: { id: sessionId },
    });
    if (!session || !session.clockOut) {
      strapi.log.info(`[Overtime] Skipped — session ${sessionId} not found or missing clockOut for user=${userId}`);
      return null;
    }

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
    const overtimeMinutes = Math.max(0, totalWorkedMinutes - expectedMinutes);

    if (overtimeMinutes <= policy.minimumOvertimeThresholdMinutes) {
      strapi.log.info(`[Overtime] Skipped — ${overtimeMinutes}min <= ${policy.minimumOvertimeThresholdMinutes}min threshold (totalWorked=${totalWorkedMinutes}, expected=${expectedMinutes}) for user=${userId}`);
      return null;
    }

    const existingToday = await strapi.db.query(OT_UID).findOne({
      where: { user: userId, date: getLocalDateString(today), status: { $ne: 'cancelled' } },
    });
    if (existingToday) {
      strapi.log.info(`[Overtime] Existing declaration id=${existingToday.id} found for user=${userId} date=${getLocalDateString(today)}`);
      return existingToday;
    }

    const ot = await strapi.db.query(OT_UID).create({
      data: {
        date: getLocalDateString(today),
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
