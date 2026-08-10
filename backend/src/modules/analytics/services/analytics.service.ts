import { ApplicationStatus, JobStatus, Prisma, VerificationStatus } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { RequestContext } from '@/types/request-context';

/** Stages a candidate passes through, in funnel order. */
const FUNNEL_ORDER: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.SCREENING,
  ApplicationStatus.SHORTLISTED,
  ApplicationStatus.WRITTEN_TEST,
  ApplicationStatus.TECHNICAL_INTERVIEW,
  ApplicationStatus.HR_INTERVIEW,
  ApplicationStatus.SELECTED,
  ApplicationStatus.JOINED,
];

const PLACED: ApplicationStatus[] = [ApplicationStatus.SELECTED, ApplicationStatus.JOINED];

export const analyticsService = {
  /**
   * Officer's placement picture. Computed from the status ledger rather than a
   * maintained stats table, so on-screen and exported numbers can't drift
   * apart (§9.12).
   */
  async collegeOverview(ctx: RequestContext) {
    const collegeId = ctx.collegeId ?? undefined;

    const [students, applications, jobs, history, pendingJobs, pendingRelease] = await Promise.all([
      prisma.studentProfile.findMany({
        where: { collegeId, deletedAt: null },
        select: { id: true, placementReady: true },
      }),
      prisma.application.findMany({
        where: { collegeId, deletedAt: null },
        select: {
          id: true,
          status: true,
          studentProfileId: true,
          job: { select: { packageLpa: true, companyId: true, company: { select: { name: true } } } },
        },
      }),
      prisma.job.count({ where: { collegeId, status: JobStatus.PUBLISHED, deletedAt: null } }),
      // The ledger tells us how far each application ever reached — a candidate
      // rejected at HR round still counts as having been interviewed.
      prisma.applicationStatusHistory.findMany({
        where: { application: { collegeId, deletedAt: null } },
        select: { applicationId: true, toStatus: true },
      }),
      prisma.job.count({ where: { collegeId, status: JobStatus.PENDING_APPROVAL, deletedAt: null } }),
      prisma.interviewRound.count({
        where: {
          job: { collegeId },
          resultsPublishedAt: { not: null },
          resultsReleasedAt: null,
        },
      }),
    ]);

    const eligible = students.filter((s) => s.placementReady);
    const placedProfileIds = new Set(
      applications.filter((a) => PLACED.includes(a.status)).map((a) => a.studentProfileId),
    );

    // Reached-stage counts, so the funnel doesn't collapse as people advance.
    const reached = new Map<ApplicationStatus, Set<string>>();
    for (const stage of FUNNEL_ORDER) reached.set(stage, new Set());
    for (const row of history) {
      reached.get(row.toStatus)?.add(row.applicationId);
    }

    const packages = applications
      .filter((a) => PLACED.includes(a.status) && a.job.packageLpa)
      .map((a) => Number(a.job.packageLpa));

    const byCompany = new Map<string, { name: string; offers: number }>();
    for (const a of applications) {
      if (!PLACED.includes(a.status)) continue;
      const entry = byCompany.get(a.job.companyId) ?? { name: a.job.company.name, offers: 0 };
      entry.offers += 1;
      byCompany.set(a.job.companyId, entry);
    }

    const selected = applications.filter((a) => a.status === ApplicationStatus.SELECTED).length;
    const joined = applications.filter((a) => a.status === ApplicationStatus.JOINED).length;

    return {
      headline: {
        studentsTotal: students.length,
        placementReady: eligible.length,
        placed: placedProfileIds.size,
        placedPercent: eligible.length
          ? Math.round((placedProfileIds.size / eligible.length) * 1000) / 10
          : 0,
        activeDrives: jobs,
        applications: applications.length,
      },
      packages: {
        highest: packages.length ? Math.max(...packages) : null,
        average: packages.length
          ? Math.round((packages.reduce((s, p) => s + p, 0) / packages.length) * 100) / 100
          : null,
        offersWithPackage: packages.length,
      },
      // Of everyone offered, how many actually joined.
      offerAcceptance: selected + joined > 0 ? Math.round((joined / (selected + joined)) * 100) : null,
      funnel: FUNNEL_ORDER.map((stage) => ({
        stage,
        count: reached.get(stage)?.size ?? 0,
      })),
      topCompanies: [...byCompany.values()].sort((a, b) => b.offers - a.offers).slice(0, 5),
      actionable: {
        jobsAwaitingApproval: pendingJobs,
        resultsAwaitingRelease: pendingRelease,
        profilesAwaitingReview: await prisma.studentProfile.count({
          where: { collegeId, submittedForReviewAt: { not: null }, placementReady: false },
        }),
        recruitersAwaitingApproval: await prisma.collegeCompanyLink.count({
          where: { collegeId, status: VerificationStatus.PENDING },
        }),
      },
    };
  },

  /** What a student sees on their own home screen. */
  async studentOverview(ctx: RequestContext) {
    const profile = await prisma.studentProfile.findUnique({
      where: { userId: ctx.userId },
      select: { id: true, placementReady: true, collegeId: true, resumeUrl: true, skills: true },
    });

    if (!profile) {
      return {
        placementReady: false,
        profileComplete: 0,
        openDrives: 0,
        applications: { total: 0, active: 0, interviewing: 0, offers: 0 },
        upcoming: [],
      };
    }

    const [applications, openDrives, upcoming] = await Promise.all([
      prisma.application.findMany({
        where: { studentProfileId: profile.id, deletedAt: null },
        select: { status: true },
      }),
      prisma.job.count({
        where: {
          collegeId: profile.collegeId,
          status: JobStatus.PUBLISHED,
          deletedAt: null,
          deadline: { gte: new Date() },
        },
      }),
      prisma.interviewRoundResult.findMany({
        where: {
          application: { studentProfileId: profile.id },
          round: { scheduledAt: { gte: new Date() } },
        },
        include: {
          round: {
            select: {
              scheduledAt: true,
              venue: true,
              meetingLink: true,
              type: true,
              sequence: true,
              job: { select: { title: true, company: { select: { name: true } } } },
            },
          },
        },
        orderBy: { round: { scheduledAt: 'asc' } },
        take: 3,
      }),
    ]);

    const inInterview: ApplicationStatus[] = [
      ApplicationStatus.WRITTEN_TEST,
      ApplicationStatus.TECHNICAL_INTERVIEW,
      ApplicationStatus.HR_INTERVIEW,
    ];

    const interviewing = applications.filter((a) => inInterview.includes(a.status)).length;

    const closed: ApplicationStatus[] = [
      ApplicationStatus.REJECTED,
      ApplicationStatus.WITHDRAWN,
      ApplicationStatus.JOINED,
    ];

    return {
      placementReady: profile.placementReady,
      hasResume: Boolean(profile.resumeUrl),
      skillCount: profile.skills.length,
      openDrives,
      applications: {
        total: applications.length,
        active: applications.filter((a) => !closed.includes(a.status)).length,
        interviewing,
        offers: applications.filter((a) => PLACED.includes(a.status)).length,
      },
      upcoming: upcoming.map((u) => ({
        jobTitle: u.round.job.title,
        company: u.round.job.company.name,
        sequence: u.round.sequence,
        type: u.round.type,
        scheduledAt: u.round.scheduledAt,
        where: u.round.venue ?? u.round.meetingLink,
      })),
    };
  },

  /** Recruiter's own numbers, across every college they post to. */
  async recruiterOverview(ctx: RequestContext) {
    const companyId = ctx.companyId ?? undefined;

    const [jobs, applications, rounds] = await Promise.all([
      prisma.job.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, status: true, title: true, deadline: true },
      }),
      prisma.application.findMany({
        where: { job: { companyId }, deletedAt: null },
        select: { status: true, jobId: true },
      }),
      prisma.interviewRound.findMany({
        where: { job: { companyId }, scheduledAt: { gte: new Date() } },
        select: {
          scheduledAt: true,
          sequence: true,
          type: true,
          venue: true,
          job: { select: { title: true } },
          _count: { select: { results: true } },
        },
        orderBy: { scheduledAt: 'asc' },
        take: 3,
      }),
    ]);

    const awaitingReview: ApplicationStatus[] = [
      ApplicationStatus.APPLIED,
      ApplicationStatus.SCREENING,
    ];

    const needsAction = applications.filter((a) => awaitingReview.includes(a.status)).length;

    return {
      jobs: {
        total: jobs.length,
        published: jobs.filter((j) => j.status === JobStatus.PUBLISHED).length,
        pendingApproval: jobs.filter((j) => j.status === JobStatus.PENDING_APPROVAL).length,
      },
      applications: {
        total: applications.length,
        needsAction,
        shortlisted: applications.filter((a) => a.status === ApplicationStatus.SHORTLISTED).length,
        selected: applications.filter((a) => PLACED.includes(a.status)).length,
      },
      upcoming: rounds.map((r) => ({
        jobTitle: r.job.title,
        sequence: r.sequence,
        type: r.type,
        scheduledAt: r.scheduledAt,
        where: r.venue,
        candidates: r._count.results,
      })),
    };
  },
};
