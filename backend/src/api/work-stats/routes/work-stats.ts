import workStats from '../controllers/work-stats';

export default {
  routes: [
    {
      method: 'GET',
      path: '/work-stats/employee',
      handler: 'work-stats.employeeStats',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/work-stats/all-employees',
      handler: 'work-stats.allEmployeeStats',
      config: { policies: [] },
    },
    {
      method: 'GET',
      path: '/work-stats/policy',
      handler: 'work-stats.policy',
      config: { policies: [] },
    },
  ],
};
