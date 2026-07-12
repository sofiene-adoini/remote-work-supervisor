export default {
  routes: [
    {
      method: 'GET',
      path: '/team-stats/dashboard',
      handler: 'team-stats.dashboard',
      config: {
        policies: [],
      },
    },
  ],
};
