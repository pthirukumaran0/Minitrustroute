import { Router } from 'express';
import { getAnalytics, getUserPersonaAnalytics } from '../controllers/analytics.controller';
import {
  getSimulationResults,
  executeSimulation,
} from '../controllers/simulation.controller';
import { optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/', getAnalytics);
router.get('/user-personas', optionalAuthenticate, getUserPersonaAnalytics);
router.get('/personas', optionalAuthenticate, getUserPersonaAnalytics);
router.get('/simulation', getSimulationResults);
router.post('/simulate', optionalAuthenticate, executeSimulation);

export default router;
