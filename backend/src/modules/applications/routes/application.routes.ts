import { Router } from 'express';
import { ApplicationStatus, Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { applicationService } from '../services/application.service';

export const applicationRoutes = Router();

applicationRoutes.use(authenticate);

const transitionSchema = z.object({
  to: z.nativeEnum(ApplicationStatus),
  note: z.string().max(500).optional(),
});

const recommendSchema = z.object({
  note: z.string().min(3).max(500),
});

/** Step 4 — student applies. */
applicationRoutes.post('/jobs/:jobId/apply', authorize(Role.STUDENT), async (req, res, next) => {
  try {
    const application = await applicationService.apply(req.params.jobId, req.ctx!);
    res.status(201).json({ data: application });
  } catch (err) {
    next(err);
  }
});

/** Student's own tracker. */
applicationRoutes.get('/mine', authorize(Role.STUDENT), async (req, res, next) => {
  try {
    res.json({ data: await applicationService.listForStudent(req.ctx!) });
  } catch (err) {
    next(err);
  }
});

applicationRoutes.post('/:id/withdraw', authorize(Role.STUDENT), async (req, res, next) => {
  try {
    res.json({ data: await applicationService.withdraw(req.params.id, req.ctx!) });
  } catch (err) {
    next(err);
  }
});

/**
 * Recruiters screen and shortlist their own candidates. The officer keeps write
 * access as an override — a stalled drive or a recruiter who goes quiet still
 * needs someone able to close applications out.
 */
applicationRoutes.patch(
  '/:id/status',
  authorize(Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN, Role.HR),
  async (req, res, next) => {
    try {
      const { to, note } = transitionSchema.parse(req.body);
      const updated = await applicationService.transition(req.params.id, to, req.ctx!, note);
      res.json({ data: updated });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Applied vs not-applied roster for a drive. Open to student coordinators —
 * names and roll numbers only, no marks, resumes or outcomes.
 */
applicationRoutes.get(
  '/jobs/:jobId/roster',
  authorize(Role.STUDENT_COORDINATOR, Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN),
  async (req, res, next) => {
    try {
      res.json({ data: await applicationService.listDriveRoster(req.params.jobId, req.ctx!) });
    } catch (err) {
      next(err);
    }
  },
);

/** Applicant pool for a job. */
applicationRoutes.get(
  '/jobs/:jobId',
  authorize(Role.HR, Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN, Role.ALUMNI),
  async (req, res, next) => {
    try {
      res.json({ data: await applicationService.listForJob(req.params.jobId, req.ctx!) });
    } catch (err) {
      next(err);
    }
  },
);

/** Step 8 — alumni endorsement. */
applicationRoutes.post('/:id/recommend', authorize(Role.ALUMNI), async (req, res, next) => {
  try {
    const { note } = recommendSchema.parse(req.body);
    const rec = await applicationService.recommend(req.params.id, note, req.ctx!);
    res.status(201).json({ data: rec });
  } catch (err) {
    next(err);
  }
});
