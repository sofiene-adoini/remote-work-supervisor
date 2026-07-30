export default {
  routes: [
    {
      method: 'GET',
      path: '/workspace/my',
      handler: 'workspace.my',
      config: {
        policies: [],
      },
    },
  ],
};
