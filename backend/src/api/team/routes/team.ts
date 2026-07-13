export default {
  routes: [
    {
      method: 'GET',
      path: '/teams',
      handler: 'team.listAll',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/teams/:teamId/members',
      handler: 'team.members',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/teams/all-members',
      handler: 'team.allMembers',
      config: {
        policies: [],
      },
    },
  ],
};
