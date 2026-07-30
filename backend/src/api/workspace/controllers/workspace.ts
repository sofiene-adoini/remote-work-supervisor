import type { Context } from 'koa';
const USER_UID = 'plugin::users-permissions.user';
const TEAM_UID = 'api::team.team';
const SESSION_UID = 'api::session.session';
const ALLOC_UID = 'api::project-time-allocation.project-time-allocation';

export default {
  async my(ctx: Context) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const user = await strapi.db.query(USER_UID).findOne({
      where: { id: userId },
      populate: ['team', 'role'],
    });
    if (!user) return ctx.notFound('User not found');

    if (!user.team) {
      return ctx.send({
        workspace: {
          user: { id: user.id, fullName: user.fullName, email: user.email },
          team: null,
          workload: null,
        },
      });
    }

    const teamId = typeof user.team === 'object' ? user.team.id : user.team;

    const team = await strapi.db.query(TEAM_UID).findOne({
      where: { id: teamId },
      populate: ['users', 'leader', 'projects'],
    });
    if (!team) {
      return ctx.send({
        workspace: {
          user: { id: user.id, fullName: user.fullName, email: user.email },
          team: null,
          workload: null,
        },
      });
    }

    const userIds = (team.users ?? []).map((u: any) => u.id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7));
    monday.setHours(0, 0, 0, 0);

    const lastMonday = new Date(monday);
    lastMonday.setDate(lastMonday.getDate() - 7);

    const sessions = await strapi.db.query(SESSION_UID).findMany({
      where: {
        user: { id: { $in: userIds } },
        clockIn: { $gte: today.toISOString() },
      },
      populate: ['user'],
      orderBy: { clockIn: 'desc' },
    });

    const latestByUser = new Map<number, any>();
    for (const s of sessions) {
      const uid = typeof s.user === 'object' ? s.user.id : s.user;
      if (uid && !latestByUser.has(uid)) latestByUser.set(uid, s);
    }

    const members = (team.users ?? []).map((u: any) => {
      const session = latestByUser.get(u.id);
      let status = 'clocked_out';
      let hoursToday = 0;
      if (session) {
        status = session.status === 'completed' ? 'clocked_out' : session.status;
        const start = new Date(session.clockIn).getTime();
        const end = session.clockOut ? new Date(session.clockOut).getTime() : Date.now();
        const breakMin = session.totalBreakMinutes || 0;
        hoursToday = Math.max(0, ((end - start) / 60000) - (breakMin / 60));
      }
      return {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        status,
        hoursToday: Math.round(hoursToday * 10) / 10,
        isLeader: team.leader?.id === u.id,
        isSelf: u.id === userId,
      };
    });

    const projects = await Promise.all(
      (team.projects ?? []).map(async (project: any) => {
        const projectId = typeof project === 'object' ? project.id : project;

        const myAllocs = await strapi.db.query(ALLOC_UID).findMany({
          where: { project: projectId, user: userId },
        });

        const myTotalMinutes = myAllocs.reduce((sum: number, a: any) => sum + (a.durationMinutes || 0), 0);

        const myWeekAllocs = myAllocs.filter((a: any) =>
          a.startTime && new Date(a.startTime).getTime() >= monday.getTime()
        );
        const myWeekMinutes = myWeekAllocs.reduce((sum: number, a: any) => sum + (a.durationMinutes || 0), 0);

        const myTodayAllocs = myAllocs.filter((a: any) =>
          a.startTime && new Date(a.startTime).getTime() >= today.getTime()
        );
        const myTodayMinutes = myTodayAllocs.reduce((sum: number, a: any) => sum + (a.durationMinutes || 0), 0);

        const myLastWeekAllocs = myAllocs.filter((a: any) =>
          a.startTime && new Date(a.startTime).getTime() >= lastMonday.getTime() && new Date(a.startTime).getTime() < monday.getTime()
        );
        const myLastWeekMinutes = myLastWeekAllocs.reduce((sum: number, a: any) => sum + (a.durationMinutes || 0), 0);

        const totalMinutes = await computeTotalAllocationMinutes(projectId);

        return {
          id: projectId,
          name: project.name,
          description: project.description ?? null,
          status: project.status,
          priority: project.priority ?? null,
          estimatedHours: project.estimatedHours ?? null,
          expectedEnd: project.expectedEnd ?? null,
          color: project.color ?? null,
          totalHours: Math.round((totalMinutes / 60) * 10) / 10,
          manager: project.manager ? { id: project.manager.id, fullName: project.manager.fullName } : null,
          progress: project.estimatedHours
            ? Math.min(100, Math.round((totalMinutes / 60 / project.estimatedHours) * 100))
            : totalMinutes > 0 ? null : 0,
          myContribution: {
            hoursTotal: Math.round((myTotalMinutes / 60) * 10) / 10,
            hoursThisWeek: Math.round((myWeekMinutes / 60) * 10) / 10,
            hoursToday: Math.round((myTodayMinutes / 60) * 10) / 10,
            hoursLastWeek: Math.round((myLastWeekMinutes / 60) * 10) / 10,
            percentage: totalMinutes > 0
              ? Math.round((myTotalMinutes / totalMinutes) * 100 * 10) / 10
              : 0,
          },
        };
      })
    );

    const sortedProjects = [...projects].sort((a, b) => a.name.localeCompare(b.name));

    const activeNow = members.filter((m: any) => m.status === 'active').length;
    const onBreak = members.filter((m: any) => m.status === 'break').length;
    const offline = members.filter((m: any) => m.status === 'clocked_out').length;
    const activeProjects = projects.filter((p: any) => p.status === 'active').length;
    const completedProjects = projects.filter((p: any) => p.status === 'completed').length;
    const hoursWorkedThisWeek = members.reduce((sum: number, m: any) => sum + m.hoursToday, 0);

    return ctx.send({
      workspace: {
        user: { id: user.id, fullName: user.fullName, email: user.email },
        role: user.role ? { id: user.role.id, name: user.role.name, type: user.role.type } : null,
        team: {
          id: team.id,
          name: team.name,
          description: team.description ?? null,
          leader: team.leader
            ? { id: team.leader.id, fullName: team.leader.fullName, email: team.leader.email }
            : null,
          memberCount: (team.users ?? []).length,
          members,
          projectCount: (team.projects ?? []).length,
          projects: sortedProjects,
          createdAt: team.createdAt ?? null,
        },
        workload: {
          activeNow,
          onBreak,
          offline,
          activeProjects,
          completedProjects,
          hoursWorkedThisWeek: Math.round(hoursWorkedThisWeek * 10) / 10,
        },
      },
    });
  },
};

async function computeTotalAllocationMinutes(projectId: number): Promise<number> {
  const allocs = await strapi.db.query(ALLOC_UID).findMany({
    where: { project: projectId },
  });
  return allocs.reduce((sum, a: any) => sum + (a.durationMinutes || 0), 0);
}
