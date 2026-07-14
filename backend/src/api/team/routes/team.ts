export default {
  routes: [
    {
      method: 'GET',
      path: '/teams/available-managers',
      handler: 'team.availableManagers',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/teams/unassigned-employees',
      handler: 'team.unassignedEmployees',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/teams',
      handler: 'team.create',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/teams/:id/members',
      handler: 'team.updateMembers',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/teams/:id/manager',
      handler: 'team.updateManager',
      config: {
        policies: [],
      },
    },
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
