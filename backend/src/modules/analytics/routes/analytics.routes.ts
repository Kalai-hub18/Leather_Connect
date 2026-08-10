import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { analyticsService } from '../services/analytics.service';

export const analyticsRoutes = Router();

analyticsRoutes.use(authenticate);

/** Officer / admin placement picture for their college. */
analyticsRoutes.get(
  '/college',
  authorize(Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN, Role.SUPER_ADMIN),
  async (req, res, next) => {
    try {
      res.json({ data: await analyticsService.collegeOverview(req.ctx!) });
    } catch (err) {
      next(err);
    }
  },
);

analyticsRoutes.get('/student', authorize(Role.STUDENT), async (req, res, next) => {
  try {
    res.json({ data: await analyticsService.studentOverview(req.ctx!) });
  } catch (err) {
    next(err);
  }
});

analyticsRoutes.get('/recruiter', authorize(Role.HR), async (req, res, next) => {
  try {
    res.json({ data: await analyticsService.recruiterOverview(req.ctx!) });
  } catch (err) {
    next(err);
  }
});
