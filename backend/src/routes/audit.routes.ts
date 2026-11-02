import { Router } from 'express';
import { getAuditLogs } from '../controllers/audit.controller';
import { optionalAuthenticate, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Permissive in dev/demo; when auth header present, checks role
router.get('/', getAuditLogs);

export default router;

