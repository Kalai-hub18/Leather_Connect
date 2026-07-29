import { z } from 'zod';
import { JobType } from '@prisma/client';

export const createJobSchema = z.object({
  collegeId: z.string().uuid(),
  title: z.string().min(3).max(160),
  description: z.string().min(10),
  type: z.nativeEnum(JobType),
  location: z.string().max(120).optional(),
  packageLpa: z.number().positive().optional(),
  stipend: z.string().max(60).optional(),
  deadline: z.coerce.date(),
  eligibility: z.object({
    minCgpa: z.number().min(0).max(10).optional(),
    maxBacklogs: z.number().int().min(0).optional(),
    departmentIds: z.array(z.string().uuid()).default([]),
    batchYears: z.array(z.number().int()).default([]),
    requiredSkills: z.array(z.string()).default([]),
  }),
});

export const approveJobSchema = z.object({
  note: z.string().max(500).optional(),
});

export const rejectJobSchema = z.object({
  reason: z.string().min(3).max(500),
});

export type CreateJobInput = z.infer<typeof createJobSchema>;
