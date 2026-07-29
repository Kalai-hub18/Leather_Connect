import { Router } from 'express';
import { AttendanceStatus, InterviewRoundType, Role, RoundOutcome } from '@prisma/client';
import { z } from 'zod';
import { authenticate } from '@/middleware/authenticate';
import { authorize } from '@/middleware/authorize';
import { interviewService } from '../services/interview.service';

export const interviewRoutes = Router();

interviewRoutes.use(authenticate);

const createRoundSchema = z.object({
  sequence: z.number().int().positive(),
  type: z.nativeEnum(InterviewRoundType),
  scheduledAt: z.coerce.date(),
  venue: z.string().max(200).optional(),
  meetingLink: z.string().url().optional(),
  interviewers: z.array(z.string()).default([]),
});

const recordResultSchema = z.object({
  attendance: z.nativeEnum(AttendanceStatus),
  rating: z.number().int().min(1).max(5).optional(),
  feedback: z.string().max(1000).optional(),
  outcome: z.nativeEnum(RoundOutcome),
});

/** Step 6a — create a round, auto-attaching candidates at the right stage. */
interviewRoutes.post(
  '/jobs/:jobId/rounds',
  authorize(Role.HR, Role.PLACEMENT_OFFICER),
  async (req, res, next) => {
    try {
      const input = createRoundSchema.parse(req.body);
      const round = await interviewService.createRound(req.params.jobId, input, req.ctx!);
      res.status(201).json({ data: round });
    } catch (err) {
      next(err);
    }
  },
);

interviewRoutes.get('/jobs/:jobId/rounds', async (req, res, next) => {
  try {
    res.json({ data: await interviewService.listRounds(req.params.jobId) });
  } catch (err) {
    next(err);
  }
});

/** Step 6b — attendance + feedback per candidate. */
interviewRoutes.patch(
  '/rounds/:roundId/results/:applicationId',
  authorize(Role.HR, Role.PLACEMENT_OFFICER),
  async (req, res, next) => {
    try {
      const input = recordResultSchema.parse(req.body);
      const result = await interviewService.recordResult(
        req.params.roundId,
        req.params.applicationId,
        input,
        req.ctx!,
      );
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

/** Rounds the officer still has to sign off on, with SLA flags. */
interviewRoutes.get(
  '/awaiting-release',
  authorize(Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN),
  async (req, res, next) => {
    try {
      res.json({ data: await interviewService.listAwaitingRelease(req.ctx!) });
    } catch (err) {
      next(err);
    }
  },
);

/** The officer's gate — makes a published round's outcome visible to students. */
interviewRoutes.post(
  '/rounds/:roundId/release',
  authorize(Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN),
  async (req, res, next) => {
    try {
      const round = await interviewService.releaseResults(req.params.roundId, req.ctx!);
      res.json({ data: round });
    } catch (err) {
      next(err);
    }
  },
);

/** Step 6c — publish, auto-advancing every application. */
interviewRoutes.post(
  '/rounds/:roundId/publish',
  authorize(Role.HR, Role.PLACEMENT_OFFICER),
  async (req, res, next) => {
    try {
      const summary = await interviewService.publishResults(req.params.roundId, req.ctx!);
      res.json({ data: summary });
    } catch (err) {
      next(err);
    }
  },
);
