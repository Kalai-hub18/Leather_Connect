import { Router } from 'express';
import { authenticate } from '@/middleware/authenticate';
import { notificationService } from '../services/notification.service';

export const notificationRoutes = Router();

notificationRoutes.use(authenticate);

notificationRoutes.get('/', async (req, res, next) => {
  try {
    const unreadOnly = req.query.unread === '1';
    res.json({ data: await notificationService.list(req.ctx!, { unreadOnly }) });
  } catch (err) {
    next(err);
  }
});

notificationRoutes.get('/unread-count', async (req, res, next) => {
  try {
    res.json({ data: { count: await notificationService.unreadCount(req.ctx!) } });
  } catch (err) {
    next(err);
  }
});

notificationRoutes.post('/:id/read', async (req, res, next) => {
  try {
    res.json({ data: await notificationService.markRead(req.params.id, req.ctx!) });
  } catch (err) {
    next(err);
  }
});

notificationRoutes.post('/read-all', async (req, res, next) => {
  try {
    res.json({ data: await notificationService.markAllRead(req.ctx!) });
  } catch (err) {
    next(err);
  }
});
