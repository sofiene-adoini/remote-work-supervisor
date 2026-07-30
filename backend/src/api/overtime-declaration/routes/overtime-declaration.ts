export default {
  routes: [
    {
      method: 'GET',
      path: '/overtime-declarations/my',
      handler: 'overtime-declaration.myDeclarations',
      config: {
        auth: { scope: ['api::overtime-declaration.overtime-declaration.myDeclarations'] },
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/overtime-declarations/my/recent',
      handler: 'overtime-declaration.recentDecisions',
      config: {
        auth: { scope: ['api::overtime-declaration.overtime-declaration.myDeclarations'] },
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/overtime-declarations/pending',
      handler: 'overtime-declaration.pending',
      config: {
        auth: { scope: ['api::overtime-declaration.overtime-declaration.pending'] },
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/overtime-declarations/all',
      handler: 'overtime-declaration.allDeclarations',
      config: {
        auth: { scope: ['api::overtime-declaration.overtime-declaration.allDeclarations'] },
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/overtime-declarations/hr/stats',
      handler: 'overtime-declaration.hrStats',
      config: {
        auth: { scope: ['api::overtime-declaration.overtime-declaration.allDeclarations'] },
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/overtime-declarations/:id/submit',
      handler: 'overtime-declaration.submitJustification',
      config: {
        auth: { scope: ['api::overtime-declaration.overtime-declaration.submitJustification'] },
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/overtime-declarations/:id/cancel',
      handler: 'overtime-declaration.cancel',
      config: {
        auth: { scope: ['api::overtime-declaration.overtime-declaration.cancel'] },
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/overtime-declarations/:id/approve',
      handler: 'overtime-declaration.approve',
      config: {
        auth: { scope: ['api::overtime-declaration.overtime-declaration.approve'] },
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/overtime-declarations/:id/reject',
      handler: 'overtime-declaration.reject',
      config: {
        auth: { scope: ['api::overtime-declaration.overtime-declaration.reject'] },
        policies: [],
      },
    },
  ],
};
