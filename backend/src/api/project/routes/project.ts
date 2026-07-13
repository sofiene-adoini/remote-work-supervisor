export default {
  routes: [
    {
      method: 'GET',
      path: '/projects/my',
      handler: 'project.myProjects',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/time-entries',
      handler: 'project.logTime',
      config: {
        policies: [],
      },
    },
  ],
};
