export default {
  routes: [
    {
      method: 'GET',
      path: '/projects/list-all',
      handler: 'project.listAll',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/projects',
      handler: 'project.create',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/projects/:id/reassign',
      handler: 'project.reassign',
      config: {
        policies: [],
      },
    },
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
