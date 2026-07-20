export default {
  routes: [
    {
      method: 'GET',
      path: '/screenshot-analyses',
      handler: 'screenshot-analysis.find',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/screenshot-analyses/:id',
      handler: 'screenshot-analysis.findOne',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/screenshot-analyses/:id/status',
      handler: 'screenshot-analysis.updateStatus',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/screenshot-analyses/my',
      handler: 'screenshot-analysis.myAnalyses',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/screenshot-analyses/submit',
      handler: 'screenshot-analysis.submit',
      config: {
        policies: ['plugin::users-permissions.isAuthenticatedUser'],
      },
    },
    {
      method: 'POST',
      path: '/screenshot-analyses',
      handler: 'screenshot-analysis.create',
      config: {
        policies: [],
      },
    },
  ],
};
