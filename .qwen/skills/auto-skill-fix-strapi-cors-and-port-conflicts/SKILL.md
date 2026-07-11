---
name: fix-strapi-cors-and-port-conflicts
description: Procedure to fix Strapi CORS middleware warning and resolve port conflicts for backend and frontend servers
source: auto-skill
extracted_at: '2026-07-10T14:10:07.918Z'
---

When encountering the Strapi warning about the `enabled` option in cors middleware and port already in use errors, follow these steps:

**Rule/Fact:** 
- Remove the deprecated `enabled: true` option from the Strapi CORS middleware configuration.
- Identify and terminate processes using the required ports (1337 for backend, 4200 for frontend) before restarting servers.

**Why:** 
The `enabled` option in `strapi::cors` middleware is deprecated and causes an insecure default warning. Port conflicts occur when previous server instances haven't been properly shut down, preventing new instances from binding to the same ports.

**How to apply:**
1. Fix CORS middleware configuration:
   - Navigate to `backend/config/middlewares.ts` (or `backend/config/middleware.js` for older versions)
   - Locate the `strapi::cors` middleware configuration object
   - Remove the `enabled: true,` line from the config object
   - Save the file

2. Resolve port conflicts:
   - For port 1337 (backend):
     * Run `netstat -ano | findstr :1337` to find the PID
     * Run `taskkill /PID <PID> /F` to terminate the process
   - For port 4200 (frontend):
     * Run `netstat -ano | findstr :4200` to find the PID
     * Run `taskkill /PID <PID> /F` to terminate the process

3. Restart the servers:
   - Backend: `cd backend && npm run develop`
   - Frontend: `cd frontend && npm start`

Note: Always verify ports are free before starting servers to avoid conflicts.