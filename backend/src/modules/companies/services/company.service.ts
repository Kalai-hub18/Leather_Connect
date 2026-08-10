import { NotificationType, Role, VerificationStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '@/config/prisma';
import { AppError } from '@/middleware/error-handler';
import { RequestContext } from '@/types/request-context';
import { notificationService } from '@/modules/notifications/services/notification.service';
import { jobService } from '@/modules/jobs/services/job.service';

const BCRYPT_COST = 12;

export interface RecruiterSignup {
  fullName: string;
  email: string;
  password: string;
  collegeId: string;
  /** Join an existing company, or describe a new one — never both. */
  companyId?: string;
  company?: {
    name: string;
    industry?: string;
    website?: string;
    location?: string;
    description?: string;
  };
}

export const companyService = {
  /** Companies a recruiter can pick from at signup — verified ones only. */
  async listVerified() {
    return prisma.company.findMany({
      where: { status: VerificationStatus.APPROVED, deletedAt: null },
      select: { id: true, name: true, industry: true },
      orderBy: { name: 'asc' },
    });
  },

  /** Colleges a recruiter can request access to. */
  async listColleges() {
    return prisma.college.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  },

  /**
   * UC-1 — a recruiter registers themselves and their company, then waits for
   * a placement officer to approve the pairing before they can post.
   */
  async register(input: RecruiterSignup) {
    if (Boolean(input.companyId) === Boolean(input.company)) {
      throw new AppError(
        400,
        'AMBIGUOUS_COMPANY',
        'Pick an existing company or describe a new one, not both',
      );
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }

    const college = await prisma.college.findUnique({ where: { id: input.collegeId } });
    if (!college || college.deletedAt) {
      throw new AppError(404, 'COLLEGE_NOT_FOUND', 'That college is not on the platform');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

    const result = await prisma.$transaction(async (tx) => {
      let companyId = input.companyId;

      if (input.company) {
        const duplicate = await tx.company.findFirst({
          where: { name: { equals: input.company.name, mode: 'insensitive' }, deletedAt: null },
        });
        if (duplicate) {
          throw new AppError(
            409,
            'COMPANY_EXISTS',
            `${duplicate.name} is already on the platform — select it instead of adding it again`,
          );
        }

        // A brand-new company starts unverified; the officer reviewing the
        // college link is also vouching for the company itself.
        const created = await tx.company.create({
          data: { ...input.company, status: VerificationStatus.PENDING },
        });
        companyId = created.id;
      }

      const user = await tx.user.create({
        data: {
          email: input.email,
          fullName: input.fullName,
          passwordHash,
          role: Role.HR,
          companyId,
          // Email verification is a later phase; officer approval is the gate
          // that actually matters before a recruiter can reach students.
          emailVerifiedAt: new Date(),
        },
      });

      const link = await tx.collegeCompanyLink.upsert({
        where: {
          collegeId_companyId: { collegeId: input.collegeId, companyId: companyId! },
        },
        create: {
          collegeId: input.collegeId,
          companyId: companyId!,
          status: VerificationStatus.PENDING,
        },
        update: {},
      });

      return { user, companyId: companyId!, link };
    });

    await jobService.notifyOfficers(
      input.collegeId,
      NotificationType.JOB_PENDING_APPROVAL,
      'A recruiter wants access',
      `${input.fullName} registered and is waiting for approval to post at your college.`,
      '/officer/recruiters',
    );

    return { userId: result.user.id, companyId: result.companyId, status: result.link.status };
  },

  /** The officer's recruiter-verification queue. */
  async listPendingLinks(ctx: RequestContext) {
    const links = await prisma.collegeCompanyLink.findMany({
      where: { collegeId: ctx.collegeId ?? undefined, status: VerificationStatus.PENDING },
      include: {
        company: {
          include: {
            users: {
              where: { role: Role.HR, deletedAt: null },
              select: { id: true, fullName: true, email: true, createdAt: true },
            },
            _count: { select: { jobs: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return links.map((l) => ({
      linkId: l.id,
      requestedAt: l.createdAt,
      company: {
        id: l.company.id,
        name: l.company.name,
        industry: l.company.industry,
        website: l.company.website,
        location: l.company.location,
        description: l.company.description,
        status: l.company.status,
        /** Zero means nobody has vouched for this company anywhere yet. */
        priorDrives: l.company._count.jobs,
      },
      recruiters: l.company.users,
    }));
  },

  async decide(linkId: string, approved: boolean, ctx: RequestContext, reason?: string) {
    const link = await prisma.collegeCompanyLink.findUnique({
      where: { id: linkId },
      include: { company: { include: { users: { where: { role: Role.HR }, select: { id: true } } } } },
    });

    if (!link) {
      throw new AppError(404, 'LINK_NOT_FOUND', 'Request not found');
    }
    if (link.collegeId !== ctx.collegeId) {
      throw new AppError(403, 'FORBIDDEN', 'This request belongs to another college');
    }
    if (link.status !== VerificationStatus.PENDING) {
      throw new AppError(409, 'ALREADY_DECIDED', 'This request has already been decided');
    }

    if (!approved && !reason) {
      throw new AppError(400, 'REASON_REQUIRED', 'Tell the recruiter why so they can fix it');
    }

    await prisma.$transaction(async (tx) => {
      await tx.collegeCompanyLink.update({
        where: { id: linkId },
        data: {
          status: approved ? VerificationStatus.APPROVED : VerificationStatus.REJECTED,
          approvedAt: approved ? new Date() : null,
          rejectionReason: approved ? null : reason,
        },
      });

      // Approving the link is also the moment the company itself becomes
      // verified — an officer vouching for them is the whole signal we have.
      if (approved && link.company.status === VerificationStatus.PENDING) {
        await tx.company.update({
          where: { id: link.companyId },
          data: { status: VerificationStatus.APPROVED },
        });
      }
    });

    await notificationService.dispatch(
      link.company.users.map((u) => ({
        userId: u.id,
        type: NotificationType.JOB_PENDING_APPROVAL,
        title: approved ? 'You can now post jobs' : 'Access request declined',
        body: approved
          ? 'Your company was approved. Create your first posting whenever you like.'
          : (reason as string),
        link: '/hr/jobs',
      })),
    );

    return { approved };
  },
};
