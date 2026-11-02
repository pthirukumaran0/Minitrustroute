import { Router } from 'express';
import { getUsers, updateUserRole, updateUserStatus } from '../controllers/users.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';

const router = Router();

// All user management routes require Admin privileges
router.use(authenticateToken);
router.use(requireRole(['admin']));

router.get('/', getUsers);
router.patch('/:id/role', updateUserRole);
router.put('/:id/role', updateUserRole);
router.patch('/:id/status', updateUserStatus);
router.put('/:id/status', updateUserStatus);

export default router;

