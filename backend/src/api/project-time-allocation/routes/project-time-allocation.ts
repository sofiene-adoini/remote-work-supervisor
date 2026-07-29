export default {
  routes: [
    {
      method: 'GET',
      path: '/project-allocations/active',
      handler: 'project-time-allocation.myActive',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/project-allocations/switch',
      handler: 'project-time-allocation.switchProject',
      config: { policies: [] },
    },
    {
      method: 'POST',
      path: '/project-allocations/stop',
      handler: 'project-time-allocation.stopProject',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/project-allocations/my-time',
      handler: 'project-time-allocation.myProjectTime',
      config: { policies: [] },
    },
  ],
};
