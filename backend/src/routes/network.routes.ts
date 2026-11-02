import { Router } from 'express';
import {
  getNetwork,
  routePreview,
  updateConnection,
  createConnection,
  deleteConnection,
} from '../controllers/network.controller';
import { optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getNetwork);
router.post('/route-preview', routePreview);
router.post('/connections', optionalAuthenticate, createConnection);
router.patch('/connections', optionalAuthenticate, updateConnection);
router.put('/connections', optionalAuthenticate, updateConnection);
router.delete('/connections', optionalAuthenticate, deleteConnection);

export default router;

