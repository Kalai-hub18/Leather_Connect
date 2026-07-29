import { Router } from 'express';
import { Role } from '@prisma/client';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { jobService } from '../services/job.service';
import { approveJobSchema, createJobSchema, rejectJobSchema } from '../schemas/job.schemas';

export const jobRoutes = Router();

jobRoutes.use(authenticate);

/** Step 1 — HR posts a job (lands in PENDING_APPROVAL). */
jobRoutes.post('/', authorize(Role.HR), async (req, res, next) => {
  try {
    const input = createJobSchema.parse(req.body);
    const job = await jobService.create(input, req.ctx!);
    res.status(201).json({ data: job });
  } catch (err) {
    next(err);
  }
});

/** Step 2 — coordinator approves; response reports who matched. */
jobRoutes.post(
  '/:id/approve',
  authorize(Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN),
  async (req, res, next) => {
    try {
      approveJobSchema.parse(req.body ?? {});
      const result = await jobService.approve(req.params.id, req.ctx!);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

jobRoutes.post(
  '/:id/reject',
  authorize(Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN),
  async (req, res, next) => {
    try {
      const { reason } = rejectJobSchema.parse(req.body);
      const job = await jobService.reject(req.params.id, reason, req.ctx!);
      res.json({ data: job });
    } catch (err) {
      next(err);
    }
  },
);

/** Student job board — also the list coordinators and alumni work from. */
jobRoutes.get(
  '/published',
  authorize(
    Role.STUDENT,
    Role.ALUMNI,
    Role.PLACEMENT_OFFICER,
    Role.STUDENT_COORDINATOR,
    Role.COLLEGE_ADMIN,
  ),
  async (req, res, next) => {
    try {
      res.json({ data: await jobService.listPublished(req.ctx!) });
    } catch (err) {
      next(err);
    }
  },
);

/** Coordinator review queue. */
jobRoutes.get(
  '/pending-approval',
  authorize(Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN),
  async (req, res, next) => {
    try {
      res.json({ data: await jobService.listPendingApproval(req.ctx!) });
    } catch (err) {
      next(err);
    }
  },
);

/** HR's own postings. */
jobRoutes.get('/mine', authorize(Role.HR), async (req, res, next) => {
  try {
    res.json({ data: await jobService.listForCompany(req.ctx!) });
  } catch (err) {
    next(err);
  }
});

/** Colleges this HR's company is approved to post to — drives the job form. */
jobRoutes.get('/target-colleges', authorize(Role.HR), async (req, res, next) => {
  try {
    res.json({ data: await jobService.listApprovedColleges(req.ctx!) });
  } catch (err) {
    next(err);
  }
});
