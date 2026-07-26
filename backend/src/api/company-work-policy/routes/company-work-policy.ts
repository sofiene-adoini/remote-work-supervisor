import policy from '../controllers/company-work-policy';

export default {
  routes: [
    {
      method: 'GET',
      path: '/company-work-policy',
      handler: 'company-work-policy.find',
      config: { policies: [] },
    },
    {
      method: 'PUT',
      path: '/company-work-policy',
      handler: 'company-work-policy.update',
      config: { policies: [] },
    },
  ],
};
