export default {
  routes: [
    { method: 'GET', path: '/hr-analytics/summary', handler: 'hr-analytics.summary', config: { policies: [] } },
    { method: 'GET', path: '/hr-analytics/employees', handler: 'hr-analytics.employees', config: { policies: [] } },
    { method: 'GET', path: '/hr-analytics/employee/:id', handler: 'hr-analytics.employeeDetail', config: { policies: [] } },
    { method: 'PUT', path: '/hr-analytics/employee/:id', handler: 'hr-analytics.updateEmployee', config: { policies: [] } },
    { method: 'DELETE', path: '/hr-analytics/employee/:id', handler: 'hr-analytics.softDeleteEmployee', config: { policies: [] } },
    { method: 'POST', path: '/hr-analytics/employee/:id/suspend', handler: 'hr-analytics.suspendEmployee', config: { policies: [] } },
    { method: 'POST', path: '/hr-analytics/employee/:id/reactivate', handler: 'hr-analytics.reactivateEmployee', config: { policies: [] } },
    { method: 'POST', path: '/hr-analytics/employee/:id/restore', handler: 'hr-analytics.restoreEmployee', config: { policies: [] } },
    { method: 'POST', path: '/hr-analytics/employee/:id/reset-password', handler: 'hr-analytics.resetPassword', config: { policies: [] } },
    { method: 'GET', path: '/hr-analytics/employee/:id/sessions', handler: 'hr-analytics.employeeSessions', config: { policies: [] } },
    { method: 'GET', path: '/hr-analytics/employee/:id/timeline', handler: 'hr-analytics.employeeTimeline', config: { policies: [] } },
    { method: 'GET', path: '/hr-analytics/charts', handler: 'hr-analytics.charts', config: { policies: [] } },
    { method: 'GET', path: '/hr-analytics/export', handler: 'hr-analytics.exportCsv', config: { policies: [] } },
    { method: 'GET', path: '/hr-analytics/roles', handler: 'hr-analytics.roles', config: { policies: [] } },
  ],
};
