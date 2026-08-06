# PRODUCTION DEPLOYMENT & DEVOPS GUIDE
## GOC STUDIO MANAGEMENT SYSTEM CRM

---

## 1. Automated Production Deployment Workflow

Production deployment to live VPS (`72.61.243.180`) is automated via [deploy_live.js](file:///c:/Users/vishv/OneDrive/Desktop/goc-software-main/goc-software-main/deploy_live.js).

### Deployment Execution Command:
```powershell
powershell -ExecutionPolicy Bypass -Command "node deploy_live.js"
```

### What `deploy_live.js` Automates:
1. **SFTP File Upload**: Uploads modified backend controllers, services, routes, utils, database migrations, frontend views, and configuration files to `/root/goc-software`.
2. **Environment Synchronization**: Copies `/root/goc-software/.env` to `/root/goc-software/backend/.env`.
3. **Remote Backend Compilation**: Executes `npm run build` (`tsc`) inside `/root/goc-software/backend`.
4. **Remote Frontend Build**: Executes `npm run build` (`vite build`) inside `/root/goc-software/frontend` and copies compiled static assets to `/var/www/goc-studio/`.
5. **PM2 Restart with Environment Reload**: Restarts backend process via `pm2 restart goc-backend --update-env`.
6. **Token Architecture Verification**: PM2 startup runs `validateMetaTokenArchitectureOnStartup()` and prints diagnostics to PM2 stdout.

---

## 2. Manual PM2 Management Commands on VPS

```bash
# SSH Connection to Live VPS
ssh root@72.61.243.180

# Check process status
pm2 status

# View live startup logs
pm2 logs goc-backend --lines 50

# Restart backend process with environment update
pm2 restart goc-backend --update-env

# Restart Nginx web server
systemctl restart nginx
```

---

## 3. Pre-Deployment Health & Build Checklist

Before running deployment:
- [x] Run `npm run build` in `/backend` — 0 TypeScript compilation errors.
- [x] Run `npm run build` in `/frontend` — 0 Vite bundling errors.
- [x] Confirm no secret key changes (`JWT_SECRET`) in `.env`.
- [x] Confirm deployment script completed with exit code 0 (`✅ ALL DONE — Live server updated!`).
