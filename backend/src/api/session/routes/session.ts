import session from '../controllers/session';

export default {
  routes: [
    {
      method: 'GET',
      path: '/sessions/status',
      handler: 'session.currentStatus',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/sessions/clock-in',
      handler: 'session.clockIn',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/sessions/clock-out',
      handler: 'session.clockOut',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/sessions/break-start',
      handler: 'session.startBreak',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/sessions/break-end',
      handler: 'session.endBreak',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/sessions/weekly-hours',
      handler: 'session.weeklyHours',
      config: {
        policies: [],
      },
    },
  ],
};
