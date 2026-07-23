export default {
  routes: [
    { method: 'POST', path: '/agent/pairing-code', handler: 'agent.generateCode', config: { policies: [] } },
    { method: 'POST', path: '/agent/pair', handler: 'agent.pair', config: { auth: false, policies: [] } },
    { method: 'POST', path: '/agent/refresh', handler: 'agent.refreshToken', config: { auth: false, policies: [] } },
    { method: 'POST', path: '/agent/heartbeat', handler: 'agent.heartbeat', config: { auth: false, policies: [] } },
    { method: 'GET', path: '/agent/devices', handler: 'agent.listDevices', config: { policies: [] } },
    { method: 'GET', path: '/agent/devices/:id', handler: 'agent.getDevice', config: { policies: [] } },
    { method: 'PUT', path: '/agent/devices/:id/unpair', handler: 'agent.unpair', config: { policies: [] } },
    { method: 'PUT', path: '/agent/devices/:id/rename', handler: 'agent.renameDevice', config: { policies: [] } },
    { method: 'POST', path: '/agent/unpair-self', handler: 'agent.unpairSelf', config: { policies: [] } },
    { method: 'GET', path: '/agent/admin/devices', handler: 'agent.hrListAllDevices', config: { policies: [] } },
    { method: 'PUT', path: '/agent/admin/devices/:id/revoke', handler: 'agent.revokeByHr', config: { policies: [] } },
  ],
};
