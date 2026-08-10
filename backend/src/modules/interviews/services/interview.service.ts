import {
  ApplicationStatus,
  AttendanceStatus,
  InterviewRoundType,
  NotificationType,
  RoundOutcome,
} from '@prisma/client';
import { prisma } from '@/config/prisma';
import { AppError } from '@/middleware/error-handler';
import { RequestContext } from '@/types/request-context';
import { applicationService } from '@/modules/applications/services/application.service';
import { jobService } from '@/modules/jobs/services/job.service';
import { notificationService } from '@/modules/notifications/services/notification.service';

/** How long an officer may sit on a published result before it's flagged. */
export const RELEASE_SLA_HOURS = 48;

/** Which application status a round of each type advances a candidate into. */
const ADVANCE_TO: Record<InterviewRoundType, ApplicationStatus> = {
  WRITTEN_TEST: ApplicationStatus.WRITTEN_TEST,
  TECHNICAL: ApplicationStatus.TECHNICAL_INTERVIEW,
  HR: ApplicationStatus.HR_INTERVIEW,
  MANAGERIAL: ApplicationStatus.HR_INTERVIEW,
};

export const interviewService = {
  /**
   * Step 6a — create a round and attach every currently shortlisted
   * application to it (UC-4).
   */
  async createRound(
    jobId: string,
    input: {
      sequence: number;
      type: InterviewRoundType;
      scheduledAt: Date;
      venue?: string;
      meetingLink?: string;
      interviewers: string[];
    },
    ctx: RequestContext,
  ) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found');
    }
    if (ctx.companyId && job.companyId !== ctx.companyId) {
      throw new AppError(403, 'FORBIDDEN', 'This job belongs to another company');
    }

    const duplicate = await prisma.interviewRound.findUnique({
      where: { jobId_sequence: { jobId, sequence: input.sequence } },
    });
    if (duplicate) {
      throw new AppError(
        409,
        'ROUND_EXISTS',
        `Round ${input.sequence} already exists for this job`,
      );
    }

    // Round 1 draws from shortlisted candidates; later rounds draw from
    // whoever a previous round advanced. SELECTED is deliberately excluded —
    // someone already through the funnel must not be pulled into a new round.
    const eligibleStatuses =
      input.sequence === 1
        ? [ApplicationStatus.SHORTLISTED]
        : [
            ApplicationStatus.WRITTEN_TEST,
            ApplicationStatus.TECHNICAL_INTERVIEW,
            ApplicationStatus.HR_INTERVIEW,
          ];

    const applications = await prisma.application.findMany({
      where: { jobId, status: { in: eligibleStatuses }, deletedAt: null },
      select: { id: true },
    });

    if (applications.length === 0) {
      throw new AppError(
        409,
        'NO_CANDIDATES',
        'No candidates are at the right stage for this round yet',
      );
    }

    const round = await prisma.interviewRound.create({
      data: {
        jobId,
        sequence: input.sequence,
        type: input.type,
        scheduledAt: input.scheduledAt,
        venue: input.venue,
        meetingLink: input.meetingLink,
        interviewers: input.interviewers,
        results: {
          create: applications.map((a) => ({ applicationId: a.id })),
        },
      },
      include: { results: true },
    });

    // FR-8.2 — everyone pulled into the round is told when and where.
    const candidates = await prisma.application.findMany({
      where: { id: { in: applications.map((a) => a.id) } },
      include: { student: { select: { userId: true } } },
    });

    const where = input.venue ?? input.meetingLink ?? 'Details to follow';

    await notificationService.dispatch(
      candidates.map((c) => ({
        userId: c.student.userId,
        type: NotificationType.INTERVIEW_SCHEDULED,
        title: `Interview scheduled — ${job.title}`,
        body: `Round ${input.sequence} on ${input.scheduledAt.toLocaleString()}. ${where}.`,
        link: '/student/applications',
      })),
    );

    return round;
  },

  /** Step 6b — attendance and structured feedback per candidate (FR-8.3). */
  async recordResult(
    roundId: string,
    applicationId: string,
    input: {
      attendance: AttendanceStatus;
      rating?: number;
      feedback?: string;
      outcome: RoundOutcome;
    },
    ctx: RequestContext,
  ) {
    const result = await prisma.interviewRoundResult.findUnique({
      where: { roundId_applicationId: { roundId, applicationId } },
      include: { round: { include: { job: true } } },
    });

    if (!result) {
      throw new AppError(404, 'RESULT_NOT_FOUND', 'This candidate is not in that round');
    }
    if (ctx.companyId && result.round.job.companyId !== ctx.companyId) {
      throw new AppError(403, 'FORBIDDEN', 'This round belongs to another company');
    }
    if (result.round.resultsPublishedAt) {
      throw new AppError(409, 'ALREADY_PUBLISHED', 'Results for this round are already published');
    }

    return prisma.interviewRoundResult.update({
      where: { roundId_applicationId: { roundId, applicationId } },
      data: input,
    });
  },

  /**
   * Step 6c — publishing transitions every application through
   * ApplicationService, so the state machine's invariants stay in one place
   * (§9.9). Absentees are rejected per the default policy.
   */
  async publishResults(roundId: string, ctx: RequestContext) {
    const round = await prisma.interviewRound.findUnique({
      where: { id: roundId },
      include: { results: true, job: true },
    });

    if (!round) {
      throw new AppError(404, 'ROUND_NOT_FOUND', 'Interview round not found');
    }
    if (ctx.companyId && round.job.companyId !== ctx.companyId) {
      throw new AppError(403, 'FORBIDDEN', 'This round belongs to another company');
    }
    if (round.resultsPublishedAt) {
      throw new AppError(409, 'ALREADY_PUBLISHED', 'Results are already published');
    }

    const pending = round.results.filter((r) => r.outcome === RoundOutcome.PENDING);
    if (pending.length > 0) {
      throw new AppError(
        409,
        'FEEDBACK_INCOMPLETE',
        `${pending.length} candidate(s) still need an outcome recorded`,
      );
    }

    const isFinalRound =
      round.type === InterviewRoundType.HR || round.type === InterviewRoundType.MANAGERIAL;

    // Each application walks a path, not a single hop. Clearing the final
    // round means moving *into* HR_INTERVIEW and then on to SELECTED — the
    // state machine has no HR_INTERVIEW-skipping edge, and shouldn't.
    const transitions: { applicationId: string; path: ApplicationStatus[] }[] = [];

    for (const result of round.results) {
      if (
        result.attendance === AttendanceStatus.ABSENT ||
        result.outcome === RoundOutcome.REJECTED
      ) {
        transitions.push({ applicationId: result.applicationId, path: [ApplicationStatus.REJECTED] });
        continue;
      }

      const stage = ADVANCE_TO[round.type];
      transitions.push({
        applicationId: result.applicationId,
        path: isFinalRound ? [stage, ApplicationStatus.SELECTED] : [stage],
      });
    }

    for (const t of transitions) {
      for (const to of t.path) {
        await applicationService.transition(
          t.applicationId,
          to,
          ctx,
          `Round ${round.sequence} (${round.type}) result`,
          // Silent by design — students hear about this when the officer
          // releases the round, not when the recruiter finishes it.
          { suppressStudentNotification: true },
        );
      }
    }

    await prisma.interviewRound.update({
      where: { id: roundId },
      data: { resultsPublishedAt: new Date() },
    });

    await jobService.notifyOfficers(
      round.job.collegeId,
      NotificationType.RESULT_RELEASED,
      'Results waiting for your release',
      `Round ${round.sequence} of "${round.job.title}" is assessed. Students see nothing until you release it.`,
      '/officer/results',
    );

    const isRejection = (t: { path: ApplicationStatus[] }) =>
      t.path[t.path.length - 1] === ApplicationStatus.REJECTED;

    return {
      advanced: transitions.filter((t) => !isRejection(t)).length,
      rejected: transitions.filter(isRejection).length,
    };
  },

  /**
   * The placement officer's gate. HR publishing advances statuses internally;
   * students see nothing until an officer has reviewed and released.
   */
  async releaseResults(roundId: string, ctx: RequestContext) {
    const round = await prisma.interviewRound.findUnique({
      where: { id: roundId },
      include: { job: true },
    });

    if (!round) {
      throw new AppError(404, 'ROUND_NOT_FOUND', 'Interview round not found');
    }
    if (round.job.collegeId !== ctx.collegeId) {
      throw new AppError(403, 'FORBIDDEN', 'This round belongs to another college');
    }
    if (!round.resultsPublishedAt) {
      throw new AppError(
        409,
        'NOT_PUBLISHED',
        'The recruiter has not finished this round yet',
      );
    }
    if (round.resultsReleasedAt) {
      throw new AppError(409, 'ALREADY_RELEASED', 'Results are already visible to students');
    }

    const released = await prisma.interviewRound.update({
      where: { id: roundId },
      data: { resultsReleasedAt: new Date(), releasedByUserId: ctx.userId },
    });

    // The outcome was withheld while the round sat unreleased, so this is the
    // first the student hears of it — send from their current status.
    const results = await prisma.interviewRoundResult.findMany({
      where: { roundId },
      include: { application: { select: { id: true, status: true } } },
    });

    for (const r of results) {
      await applicationService.notifyStudentOfStatus(r.application.id, r.application.status);
    }

    return released;
  },

  /**
   * Rounds an officer has yet to release. `hoursWaiting` powers the SLA nudge —
   * a gate students can't see behind is worse than no gate if it's forgotten.
   */
  async listAwaitingRelease(ctx: RequestContext) {
    const rounds = await prisma.interviewRound.findMany({
      where: {
        job: { collegeId: ctx.collegeId ?? undefined },
        resultsPublishedAt: { not: null },
        resultsReleasedAt: null,
      },
      include: {
        job: { include: { company: { select: { name: true } } } },
        results: { select: { outcome: true } },
      },
      orderBy: { resultsPublishedAt: 'asc' },
    });

    const now = Date.now();

    return rounds.map((r) => {
      const hoursWaiting = Math.floor(
        (now - r.resultsPublishedAt!.getTime()) / (1000 * 60 * 60),
      );
      return {
        id: r.id,
        sequence: r.sequence,
        type: r.type,
        jobTitle: r.job.title,
        companyName: r.job.company.name,
        publishedAt: r.resultsPublishedAt,
        hoursWaiting,
        overdue: hoursWaiting >= RELEASE_SLA_HOURS,
        advanced: r.results.filter((x) => x.outcome === RoundOutcome.ADVANCED).length,
        rejected: r.results.filter((x) => x.outcome === RoundOutcome.REJECTED).length,
      };
    });
  },

  async listRounds(jobId: string) {
    return prisma.interviewRound.findMany({
      where: { jobId },
      include: {
        results: {
          include: {
            application: {
              include: { student: { include: { user: { select: { fullName: true } } } } },
            },
          },
        },
      },
      orderBy: { sequence: 'asc' },
    });
  },
};
