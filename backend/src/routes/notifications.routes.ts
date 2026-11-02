import { Router } from 'express';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '../controllers/notifications.controller';

const router = Router();

router.get('/', getNotifications);
router.post('/mark-all-read', markAllNotificationsAsRead);
router.post('/:id/read', markNotificationAsRead);

export default router;

