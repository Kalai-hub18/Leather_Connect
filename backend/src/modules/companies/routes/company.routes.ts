import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { rateLimit } from '@/middleware/rate-limit';
import { companyService } from '../services/company.service';

export const companyRoutes = Router();

const registerSchema = z
  .object({
    fullName: z.string().min(2).max(120),
    email: z.string().email(),
    password: z.string().min(8).max(72),
    collegeId: z.string().uuid(),
    companyId: z.string().uuid().optional(),
    company: z
      .object({
        name: z.string().min(2).max(160),
        industry: z.string().max(120).optional(),
        website: z.string().url().optional(),
        location: z.string().max(160).optional(),
        description: z.string().max(1000).optional(),
      })
      .optional(),
  })
  .refine((v) => Boolean(v.companyId) !== Boolean(v.company), {
    message: 'Pick an existing company or describe a new one, not both',
  });

const decisionSchema = z.object({
  approved: z.boolean(),
  reason: z.string().max(500).optional(),
});

// --- public: a recruiter signing up has no account yet ---

companyRoutes.get('/directory', async (_req, res, next) => {
  try {
    res.json({ data: await companyService.listVerified() });
  } catch (err) {
    next(err);
  }
});

companyRoutes.get('/colleges', async (_req, res, next) => {
  try {
    res.json({ data: await companyService.listColleges() });
  } catch (err) {
    next(err);
  }
});

companyRoutes.post('/register', rateLimit({ windowMs: 60 * 60_000, max: 5, key: 'hr-register' }), async (req, res, next) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await companyService.register(input);
    res.status(201).json({ data: result });
  } catch (err) {
    next(err);
  }
});

// --- officer: the verification queue ---

companyRoutes.get(
  '/pending',
  authenticate,
  authorize(Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN),
  async (req, res, next) => {
    try {
      res.json({ data: await companyService.listPendingLinks(req.ctx!) });
    } catch (err) {
      next(err);
    }
  },
);

companyRoutes.post(
  '/links/:linkId/decision',
  authenticate,
  authorize(Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN),
  async (req, res, next) => {
    try {
      const { approved, reason } = decisionSchema.parse(req.body);
      res.json({ data: await companyService.decide(req.params.linkId, approved, req.ctx!, reason) });
    } catch (err) {
      next(err);
    }
  },
);
