import { Router } from 'express';
import { getHealth, getCamaraHealth } from '../controllers/health.controller';

const router = Router();

router.get('/', getHealth);
router.get('/camara', getCamaraHealth);

export default router;

