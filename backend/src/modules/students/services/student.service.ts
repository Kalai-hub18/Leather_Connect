import { NotificationType } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/middleware/error-handler';
import { RequestContext } from '@/types/request-context';
import { notificationService } from '@/modules/notifications/services/notification.service';
import { jobService } from '@/modules/jobs/services/job.service';

export interface ProfileUpdate {
  phone?: string;
  about?: string;
  skills?: string[];
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
  resumeUrl?: string;
  resumeFileName?: string;
}

/** What a profile must carry before it's worth an officer's time. */
function completeness(p: {
  phone: string | null;
  about: string | null;
  skills: string[];
  resumeUrl: string | null;
  linkedinUrl: string | null;
}) {
  const checks = [
    { key: 'phone', done: Boolean(p.phone), label: 'Add a contact number' },
    { key: 'about', done: Boolean(p.about), label: 'Write a short intro' },
    { key: 'skills', done: p.skills.length >= 3, label: 'List at least 3 skills' },
    { key: 'resume', done: Boolean(p.resumeUrl), label: 'Upload your resume' },
    { key: 'links', done: Boolean(p.linkedinUrl), label: 'Add a LinkedIn or portfolio link' },
  ];

  const done = checks.filter((c) => c.done).length;

  return {
    percent: Math.round((done / checks.length) * 100),
    missing: checks.filter((c) => !c.done).map((c) => c.label),
  };
}

export const studentService = {
  async getOwn(ctx: RequestContext) {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: ctx.userId },
      include: {
        user: { select: { fullName: true, email: true } },
        department: { select: { name: true } },
      },
    });

    if (!profile) {
      throw new AppError(404, 'NO_PROFILE', 'No student profile on this account');
    }

    return { ...profile, completeness: completeness(profile) };
  },

  async updateOwn(input: ProfileUpdate, ctx: RequestContext) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: ctx.userId } });
    if (!profile) {
      throw new AppError(404, 'NO_PROFILE', 'No student profile on this account');
    }

    // Editing after approval sends the profile back for review — an officer
    // approved what they read, not whatever it becomes afterwards.
    const materialChange =
      input.skills !== undefined || input.resumeUrl !== undefined || input.about !== undefined;

    return prisma.studentProfile.update({
      where: { id: profile.id },
      data: {
        ...input,
        ...(materialChange && profile.placementReady
          ? { placementReady: false, submittedForReviewAt: new Date() }
          : {}),
      },
    });
  },

  async submitForReview(ctx: RequestContext) {
    const profile = await prisma.studentProfile.findUnique({ where: { userId: ctx.userId } });
    if (!profile) {
      throw new AppError(404, 'NO_PROFILE', 'No student profile on this account');
    }
    if (profile.placementReady) {
      throw new AppError(409, 'ALREADY_APPROVED', 'Your profile is already approved');
    }

    const state = completeness(profile);
    if (state.missing.length > 0) {
      throw new AppError(400, 'INCOMPLETE', `Still to do: ${state.missing.join('; ')}`);
    }

    const updated = await prisma.studentProfile.update({
      where: { id: profile.id },
      data: { submittedForReviewAt: new Date(), reviewNote: null },
    });

    await jobService.notifyOfficers(
      profile.collegeId,
      NotificationType.PROFILE_APPROVED,
      'A profile needs review',
      'A student submitted their profile for placement approval.',
      '/officer/profiles',
    );

    return updated;
  },

  /** The officer's approval queue. */
  async listForReview(ctx: RequestContext) {
    return prisma.studentProfile.findMany({
      where: {
        collegeId: ctx.collegeId ?? undefined,
        deletedAt: null,
        submittedForReviewAt: { not: null },
        placementReady: false,
      },
      include: {
        user: { select: { fullName: true, email: true } },
        department: { select: { name: true } },
      },
      orderBy: { submittedForReviewAt: 'asc' },
    });
  },

  async decide(
    profileId: string,
    approved: boolean,
    ctx: RequestContext,
    note?: string,
  ) {
    const profile = await prisma.studentProfile.findUnique({
      where: { id: profileId },
      select: { id: true, collegeId: true, userId: true },
    });

    if (!profile) {
      throw new AppError(404, 'PROFILE_NOT_FOUND', 'Profile not found');
    }
    if (profile.collegeId !== ctx.collegeId) {
      throw new AppError(403, 'FORBIDDEN', 'This student belongs to another college');
    }

    const updated = await prisma.studentProfile.update({
      where: { id: profileId },
      data: {
        placementReady: approved,
        submittedForReviewAt: null,
        reviewNote: note ?? null,
      },
    });

    await notificationService.dispatch({
      userId: profile.userId,
      type: NotificationType.PROFILE_APPROVED,
      title: approved ? 'Profile approved' : 'Profile needs changes',
      body: approved
        ? "You're placement-ready. You can now apply to any drive you're eligible for."
        : note ?? 'Your placement officer asked for some changes before approving.',
      link: '/student/profile',
    });

    return updated;
  },
};
