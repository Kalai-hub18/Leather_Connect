import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { studentService } from '../services/student.service';

export const studentRoutes = Router();

studentRoutes.use(authenticate);

const optionalUrl = z.string().url().or(z.literal('')).optional();

const updateSchema = z.object({
  phone: z.string().max(20).optional(),
  about: z.string().max(1000).optional(),
  skills: z.array(z.string().min(1).max(60)).max(30).optional(),
  linkedinUrl: optionalUrl,
  githubUrl: optionalUrl,
  portfolioUrl: optionalUrl,
  resumeUrl: optionalUrl,
  resumeFileName: z.string().max(200).optional(),
});

const decisionSchema = z.object({
  approved: z.boolean(),
  note: z.string().max(500).optional(),
});

studentRoutes.get('/me', authorize(Role.STUDENT), async (req, res, next) => {
  try {
    res.json({ data: await studentService.getOwn(req.ctx!) });
  } catch (err) {
    next(err);
  }
});

studentRoutes.patch('/me', authorize(Role.STUDENT), async (req, res, next) => {
  try {
    const input = updateSchema.parse(req.body);
    res.json({ data: await studentService.updateOwn(input, req.ctx!) });
  } catch (err) {
    next(err);
  }
});

studentRoutes.post('/me/submit', authorize(Role.STUDENT), async (req, res, next) => {
  try {
    res.json({ data: await studentService.submitForReview(req.ctx!) });
  } catch (err) {
    next(err);
  }
});

/** Officer's profile approval queue. */
studentRoutes.get(
  '/pending-review',
  authorize(Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN),
  async (req, res, next) => {
    try {
      res.json({ data: await studentService.listForReview(req.ctx!) });
    } catch (err) {
      next(err);
    }
  },
);

studentRoutes.post(
  '/:id/decision',
  authorize(Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN),
  async (req, res, next) => {
    try {
      const { approved, note } = decisionSchema.parse(req.body);
      res.json({ data: await studentService.decide(req.params.id, approved, req.ctx!, note) });
    } catch (err) {
      next(err);
    }
  },
);
