export default {
  routes: [
    { method: 'GET', path: '/hr-analytics/summary', handler: 'hr-analytics.summary', config: { policies: [] } },
    { method: 'GET', path: '/hr-analytics/employees', handler: 'hr-analytics.employees', config: { policies: [] } },
    { method: 'GET', path: '/hr-analytics/employee/:id', handler: 'hr-analytics.employeeDetail', config: { policies: [] } },
    { method: 'GET', path: '/hr-analytics/employee/:id/timeline', handler: 'hr-analytics.employeeTimeline', config: { policies: [] } },
    { method: 'GET', path: '/hr-analytics/charts', handler: 'hr-analytics.charts', config: { policies: [] } },
    { method: 'GET', path: '/hr-analytics/export', handler: 'hr-analytics.exportCsv', config: { policies: [] } },
  ],
};
