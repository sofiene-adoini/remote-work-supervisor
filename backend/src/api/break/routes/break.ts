import breakCtrl from '../controllers/break';

export default {
  routes: [
    {
      method: 'GET',
      path: '/breaks/by-session',
      handler: 'break.bySession',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/breaks/my',
      handler: 'break.my',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/breaks/employee/:userId',
      handler: 'break.employee',
      config: { policies: [] },
    },
  ],
};
