import breakCtrl from '../controllers/break';

export default {
  routes: [
    {
      method: 'GET',
      path: '/breaks/by-session',
      handler: 'break.bySession',
      config: { policies: [] },
    },
  ],
};
