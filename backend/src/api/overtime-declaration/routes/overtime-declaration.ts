export default {
  routes: [
    {
      method: 'GET',
      path: '/overtime-declarations/my',
      handler: 'overtime-declaration.myDeclarations',
      config: {
        policies: [],
      },
    },
    {
      method: 'POST',
      path: '/overtime-declarations',
      handler: 'overtime-declaration.declare',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/overtime-declarations/pending',
      handler: 'overtime-declaration.pending',
      config: {
        policies: [],
      },
    },
    {
      method: 'GET',
      path: '/overtime-declarations/all',
      handler: 'overtime-declaration.allDeclarations',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/overtime-declarations/:id/approve',
      handler: 'overtime-declaration.approve',
      config: {
        policies: [],
      },
    },
    {
      method: 'PUT',
      path: '/overtime-declarations/:id/reject',
      handler: 'overtime-declaration.reject',
      config: {
        policies: [],
      },
    },
  ],
};
