import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import {
  getMetaSettingsHandler,
  updateMetaSettingsHandler,
  validateMetaConnection,
  runMetaTest,
  subscribeMetaPageApp,
  getMetaDeveloperDiagnostics
} from '../controllers/integrationsController';

const router = Router();

// Secure all integrations endpoints to authenticated administrators only
router.use(authMiddleware);
router.use(rbac('admin'));

router.get('/meta/settings', getMetaSettingsHandler);
router.patch('/meta/settings', updateMetaSettingsHandler);
router.post('/meta/validate', validateMetaConnection);
router.post('/meta/test', runMetaTest);
router.post('/meta/subscribe', subscribeMetaPageApp);
router.get('/meta/diagnostics', getMetaDeveloperDiagnostics);

export default router;
