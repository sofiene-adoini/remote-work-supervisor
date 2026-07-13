export default {
  routes: [
    {
      method: 'GET',
      path: '/alerts/my',
      handler: 'alert.myAlerts',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/alerts/all',
      handler: 'alert.allAlerts',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/alerts/:id/read',
      handler: 'alert.markRead',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/alerts/read-all',
      handler: 'alert.markAllRead',
      config: {
        policies: [],
      },
    },
  ],
};
