import { ApplicationStatus, JobStatus, Role } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/middleware/error-handler';
import { RequestContext } from '@/types/request-context';
import { evaluate } from '@/modules/jobs/services/eligibility-engine';
import { toFacts, toRules } from '@/modules/jobs/services/job.service';
import { canTransition, allowedNext } from './state-machine';

export const applicationService = {
  /**
   * Step 4 — student applies. Eligibility, deadline and duplication are all
   * re-validated server-side even though the client already filtered (§9.8).
   */
  async apply(jobId: string, ctx: RequestContext) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: ctx.userId } });
    if (!profile) {
      throw new AppError(403, 'NO_PROFILE', 'No student profile on this account');
    }

    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { eligibility: true } });
    if (!job || job.deletedAt) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
    }
    if (job.status !== JobStatus.PUBLISHED) {
      throw new AppError(409, 'NOT_OPEN', 'This job is not open for applications');
    }
    if (job.deadline < new Date()) {
      throw new AppError(409, 'DEADLINE_PASSED', 'The application deadline has passed');
    }
    if (job.collegeId !== profile.collegeId) {
      throw new AppError(403, 'FORBIDDEN', 'This job is not open to your college');
    }

    if (job.eligibility) {
      const result = evaluate(toRules(job.eligibility), toFacts(profile));
      if (!result.eligible) {
        throw new AppError(403, 'NOT_ELIGIBLE', result.reasons.join('; '));
      }
    }

    const existing = await prisma.application.findUnique({
      where: { jobId_studentProfileId: { jobId, studentProfileId: profile.id } },
    });
    if (existing) {
      throw new AppError(409, 'ALREADY_APPLIED', 'You have already applied to this job');
    }

    // Snapshot + first ledger row are written together — an application must
    // never exist without its opening history entry.
    return prisma.$transaction(async (tx) => {
      const application = await tx.application.create({
        data: {
          jobId,
          studentProfileId: profile.id,
          collegeId: profile.collegeId,
          status: ApplicationStatus.APPLIED,
          cgpaSnapshot: profile.cgpa,
          resumeUrlSnapshot: profile.resumeUrl,
        },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId: application.id,
          fromStatus: null,
          toStatus: ApplicationStatus.APPLIED,
          actorUserId: ctx.userId,
        },
      });

      return application;
    });
  },

  /**
   * Steps 5–7 — the single place Application.status changes. The Interview
   * module calls through here rather than mutating status itself (§9.9).
   */
  async transition(
    applicationId: string,
    to: ApplicationStatus,
    ctx: RequestContext,
    note?: string,
  ) {
    const application = await prisma.application.findUnique({ where: { id: applicationId } });
    if (!application || application.deletedAt) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
    }

    const from = application.status;
    if (!canTransition(from, to)) {
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        `Cannot move from ${from} to ${to}. Allowed: ${allowedNext(from).join(', ') || 'none'}`,
      );
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.application.update({
        where: { id: applicationId },
        data: { status: to },
      });

      await tx.applicationStatusHistory.create({
        data: {
          applicationId,
          fromStatus: from,
          toStatus: to,
          actorUserId: ctx.userId,
          note,
        },
      });

      return updated;
    });
  },

  async withdraw(applicationId: string, ctx: RequestContext) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: ctx.userId } });
    const application = await prisma.application.findUnique({ where: { id: applicationId } });

    if (!application || application.studentProfileId !== profile?.id) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
    }

    return this.transition(applicationId, ApplicationStatus.WITHDRAWN, ctx);
  },

  /**
   * Student's own tracker. Interview outcomes the placement officer hasn't
   * released yet are masked — the underlying status has already advanced, but
   * the student sees "Under review" until an officer signs off.
   */
  async listForStudent(ctx: RequestContext) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: ctx.userId } });
    if (!profile) return [];

    const applications = await prisma.application.findMany({
      where: { studentProfileId: profile.id, deletedAt: null },
      include: { job: { include: { company: true } }, history: { orderBy: { createdAt: 'desc' } } },
      orderBy: { appliedAt: 'desc' },
    });

    const unreleased = await prisma.interviewRound.findMany({
      where: {
        jobId: { in: applications.map((a) => a.jobId) },
        resultsPublishedAt: { not: null },
        resultsReleasedAt: null,
        results: { some: { applicationId: { in: applications.map((a) => a.id) } } },
      },
      select: { jobId: true, resultsPublishedAt: true },
    });

    const gatedJobIds = new Map(unreleased.map((r) => [r.jobId, r.resultsPublishedAt]));

    return applications.map((app) => {
      const gatedAt = gatedJobIds.get(app.jobId);
      if (!gatedAt) return { ...app, resultPending: false };

      // Roll the visible status and history back to the last entry recorded
      // before the gated round's results landed.
      const visibleHistory = app.history.filter((h) => h.createdAt < gatedAt);

      return {
        ...app,
        status: visibleHistory[0]?.toStatus ?? app.status,
        history: visibleHistory,
        resultPending: true,
      };
    });
  },

  /**
   * Drive roster for the student placement coordinators: who has applied and
   * who hasn't, so they can chase the stragglers. Deliberately carries no CGPA,
   * no resume, no stage and no outcome — a student coordinator is a peer of
   * everyone on this list and often a competitor for the same role.
   */
  async listDriveRoster(jobId: string, ctx: RequestContext) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job || job.deletedAt) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
    }
    if (job.collegeId !== ctx.collegeId) {
      throw new AppError(403, 'FORBIDDEN', 'This drive belongs to another college');
    }

    const students = await prisma.studentProfile.findMany({
      where: { collegeId: job.collegeId, placementReady: true, deletedAt: null },
      include: { user: { select: { fullName: true } } },
      orderBy: { rollNumber: 'asc' },
    });

    const applied = await prisma.application.findMany({
      where: { jobId, deletedAt: null },
      select: { studentProfileId: true },
    });

    const appliedIds = new Set(applied.map((a) => a.studentProfileId));

    return students.map((s) => ({
      studentProfileId: s.id,
      fullName: s.user.fullName,
      rollNumber: s.rollNumber,
      batchYear: s.batchYear,
      hasApplied: appliedIds.has(s.id),
    }));
  },

  /** HR / officer view of one job's applicant pool. */
  async listForJob(jobId: string, ctx: RequestContext) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
    }

    const scopedToCompany = ctx.companyId && job.companyId !== ctx.companyId;
    const scopedToCollege = ctx.collegeId && job.collegeId !== ctx.collegeId;
    if (scopedToCompany || scopedToCollege) {
      throw new AppError(403, 'FORBIDDEN', 'You do not have access to this job');
    }

    const applications = await prisma.application.findMany({
      where: { jobId, deletedAt: null },
      include: {
        student: { include: { user: { select: { fullName: true, email: true } } } },
        recommendations: { include: { alumni: { select: { fullName: true } } } },
      },
      orderBy: { appliedAt: 'asc' },
    });

    // Alumni endorse juniors; they have no business reading contact details or
    // CGPA. Strip those rather than exposing the recruiter-grade payload.
    if (ctx.role === Role.ALUMNI) {
      return applications.map((a) => ({
        ...a,
        cgpaSnapshot: null,
        resumeUrlSnapshot: null,
        student: {
          ...a.student,
          cgpa: null,
          user: { fullName: a.student.user.fullName },
        },
      }));
    }

    return applications;
  },

  /** Step 8 — alumni endorse an application that already exists. */
  async recommend(applicationId: string, note: string, ctx: RequestContext) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { job: true },
    });

    if (!application || application.deletedAt) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found');
    }
    if (application.job.collegeId !== ctx.collegeId) {
      throw new AppError(403, 'FORBIDDEN', 'You can only recommend students from your own college');
    }

    const existing = await prisma.alumniRecommendation.findUnique({
      where: { applicationId_alumniUserId: { applicationId, alumniUserId: ctx.userId } },
    });
    if (existing) {
      throw new AppError(409, 'ALREADY_RECOMMENDED', 'You have already endorsed this candidate');
    }

    return prisma.alumniRecommendation.create({
      data: { applicationId, alumniUserId: ctx.userId, note },
    });
  },
};
