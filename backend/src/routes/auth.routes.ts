import { Router } from 'express';
import {
  login,
  register,
  logout,
  getMe,
  quickSwitch,
  getPersonas,
} from '../controllers/auth.controller';
import { authenticateToken, optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/login', login);
router.post('/register', register);
router.post('/logout', optionalAuthenticate, logout);
router.get('/me', authenticateToken, getMe);
router.post('/quick-switch', quickSwitch);
router.get('/personas', getPersonas);

export default router;

