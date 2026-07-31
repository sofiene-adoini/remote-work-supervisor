export const environment = {
  production: true,
  appName: 'Assas',
  appVersion: '1.0.0',
  apiBasePath: '/api',
  // Replace with the deployed API origin before shipping the production build.
  // The Angular app is served from the same origin, so relative paths work via apiBasePath.
  apiBaseUrl: 'http://localhost:1337',
  socketUrl: 'http://localhost:1337',
  agent: {
    // Serve the installer from this app's own static hosting by placing the
    // built setup exe at public/agent/remote-work-supervisor-setup-1.0.0.exe,
    // or replace with a full hosted installer URL.
    downloadUrl: '/agent/remote-work-supervisor-setup-1.0.0.exe',
    version: '1.0.0',
  },
};
