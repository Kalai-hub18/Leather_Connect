import { JobStatus, NotificationType, Prisma, Role, VerificationStatus } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/middleware/error-handler';
import { RequestContext } from '@/types/request-context';
import { notificationService } from '@/modules/notifications/services/notification.service';
import { CreateJobInput } from '../schemas/job.schemas';
import { evaluate, EligibilityRules, StudentFacts } from './eligibility-engine';

export const jobService = {
  /** Step 1 — HR drafts a job and submits it for coordinator review. */
  async create(input: CreateJobInput, ctx: RequestContext) {
    if (!ctx.companyId) {
      throw new AppError(403, 'NO_COMPANY', 'Only an HR account tied to a company can post jobs');
    }

    // §9.5 — the Jobs module never checks HR-to-college directly; it asks
    // whether an approved link exists for (this HR's company, target college).
    const link = await prisma.collegeCompanyLink.findUnique({
      where: { collegeId_companyId: { collegeId: input.collegeId, companyId: ctx.companyId } },
    });

    if (link?.status !== VerificationStatus.APPROVED) {
      throw new AppError(
        403,
        'COMPANY_NOT_APPROVED',
        'Your company is not approved to post to this college yet',
      );
    }

    const job = await prisma.job.create({
      data: {
        collegeId: input.collegeId,
        companyId: ctx.companyId,
        postedByUserId: ctx.userId,
        title: input.title,
        description: input.description,
        type: input.type,
        location: input.location,
        packageLpa: input.packageLpa,
        stipend: input.stipend,
        deadline: input.deadline,
        status: JobStatus.PENDING_APPROVAL,
        eligibility: {
          create: {
            minCgpa: input.eligibility.minCgpa,
            maxBacklogs: input.eligibility.maxBacklogs,
            departmentIds: input.eligibility.departmentIds,
            batchYears: input.eligibility.batchYears,
            requiredSkills: input.eligibility.requiredSkills,
          },
        },
      },
      include: { eligibility: true, company: true },
    });

    await this.notifyOfficers(
      input.collegeId,
      NotificationType.JOB_PENDING_APPROVAL,
      'A job needs your approval',
      `${job.company.name} posted "${job.title}".`,
      '/officer/approvals',
    );

    return job;
  },

  /** Fan a notice out to everyone who can act on it at a college. */
  async notifyOfficers(
    collegeId: string,
    type: NotificationType,
    title: string,
    body: string,
    link: string,
  ) {
    const officers = await prisma.user.findMany({
      where: {
        collegeId,
        role: { in: [Role.PLACEMENT_OFFICER, Role.COLLEGE_ADMIN] },
        deletedAt: null,
      },
      select: { id: true },
    });

    await notificationService.dispatch(
      officers.map((o) => ({ userId: o.id, type, title, body, link })),
    );
  },

  /**
   * Step 2 — coordinator approves. Publishing evaluates eligibility against
   * every placement-ready student in scope in one batched read (§9.7), then
   * reports who matched. Notification dispatch is the follow-on phase.
   */
  async approve(jobId: string, ctx: RequestContext) {
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { eligibility: true } });

    if (!job || job.deletedAt) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
    }
    if (job.collegeId !== ctx.collegeId) {
      throw new AppError(403, 'FORBIDDEN', 'This job belongs to another college');
    }
    if (job.status !== JobStatus.PENDING_APPROVAL) {
      throw new AppError(409, 'INVALID_STATE', `Cannot approve a job in ${job.status}`);
    }

    const published = await prisma.job.update({
      where: { id: jobId },
      data: {
        status: JobStatus.PUBLISHED,
        approvedByUserId: ctx.userId,
        publishedAt: new Date(),
      },
      include: { eligibility: true },
    });

    const matched = await this.matchEligibleStudents(jobId);

    // FR-6.3 — every eligible student hears about it. Fetch the user ids behind
    // the matched profiles in one read rather than per student.
    if (matched.length > 0) {
      const profiles = await prisma.studentProfile.findMany({
        where: { id: { in: matched } },
        select: { userId: true },
      });

      const company = await prisma.company.findUnique({
        where: { id: published.companyId },
        select: { name: true },
      });

      await notificationService.dispatch(
        profiles.map((p) => ({
          userId: p.userId,
          type: NotificationType.JOB_PUBLISHED,
          title: `New opening: ${published.title}`,
          body: `${company?.name ?? 'A recruiter'} is hiring. Applications close ${published.deadline.toLocaleDateString()}.`,
          link: '/student/jobs',
        })),
      );
    }

    return { job: published, eligibleCount: matched.length, eligibleStudentIds: matched };
  },

  async reject(jobId: string, reason: string, ctx: RequestContext) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });

    if (!job || job.deletedAt) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
    }
    if (job.collegeId !== ctx.collegeId) {
      throw new AppError(403, 'FORBIDDEN', 'This job belongs to another college');
    }
    if (job.status !== JobStatus.PENDING_APPROVAL) {
      throw new AppError(409, 'INVALID_STATE', `Cannot reject a job in ${job.status}`);
    }

    // Reverting to DRAFT lets HR revise and resubmit (UC-2 alternate path).
    const updated = await prisma.job.update({
      where: { id: jobId },
      data: { status: JobStatus.DRAFT, description: `${job.description}\n\n[Officer] ${reason}` },
    });

    await notificationService.dispatch({
      userId: job.postedByUserId,
      type: NotificationType.JOB_PENDING_APPROVAL,
      title: `Changes requested on "${job.title}"`,
      body: reason,
      link: '/hr/jobs',
    });

    return updated;
  },

  /** Batched evaluation — one read for all students, then a pure map. */
  async matchEligibleStudents(jobId: string): Promise<string[]> {
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { eligibility: true } });
    if (!job?.eligibility) return [];

    const students = await prisma.studentProfile.findMany({
      where: { collegeId: job.collegeId, placementReady: true, deletedAt: null },
    });

    const rules = toRules(job.eligibility);

    return students.filter((s) => evaluate(rules, toFacts(s)).eligible).map((s) => s.id);
  },

  /** Student-facing board: published, in-deadline jobs for their college. */
  async listPublished(ctx: RequestContext) {
    return prisma.job.findMany({
      where: {
        collegeId: ctx.collegeId ?? undefined,
        status: JobStatus.PUBLISHED,
        deletedAt: null,
        deadline: { gte: new Date() },
      },
      include: { company: true, eligibility: true, _count: { select: { applications: true } } },
      orderBy: { publishedAt: 'desc' },
    });
  },

  /** Coordinator review queue. */
  async listPendingApproval(ctx: RequestContext) {
    return prisma.job.findMany({
      where: { collegeId: ctx.collegeId ?? undefined, status: JobStatus.PENDING_APPROVAL, deletedAt: null },
      include: { company: true, eligibility: true },
      orderBy: { createdAt: 'asc' },
    });
  },

  /** Colleges whose link to this HR's company has been approved. */
  async listApprovedColleges(ctx: RequestContext) {
    if (!ctx.companyId) return [];

    const links = await prisma.collegeCompanyLink.findMany({
      where: { companyId: ctx.companyId, status: VerificationStatus.APPROVED },
      include: { college: { select: { id: true, name: true } } },
    });

    return links.map((l) => l.college);
  },

  /** HR's own postings across colleges. */
  async listForCompany(ctx: RequestContext) {
    return prisma.job.findMany({
      where: { companyId: ctx.companyId ?? undefined, deletedAt: null },
      include: { college: true, eligibility: true, _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
  },
};

export function toRules(e: {
  minCgpa: Prisma.Decimal | null;
  maxBacklogs: number | null;
  departmentIds: string[];
  batchYears: number[];
  requiredSkills: string[];
}): EligibilityRules {
  return {
    minCgpa: e.minCgpa,
    maxBacklogs: e.maxBacklogs,
    departmentIds: e.departmentIds,
    batchYears: e.batchYears,
    requiredSkills: e.requiredSkills,
  };
}

export function toFacts(s: {
  departmentId: string;
  batchYear: number;
  cgpa: Prisma.Decimal;
  activeBacklogs: number;
  skills: string[];
  placementReady: boolean;
}): StudentFacts {
  return {
    departmentId: s.departmentId,
    batchYear: s.batchYear,
    cgpa: s.cgpa,
    activeBacklogs: s.activeBacklogs,
    skills: s.skills,
    placementReady: s.placementReady,
  };
}
