import { api } from './client';
import type {
  ApplicantRow,
  Application,
  ApplicationStatus,
  AttendanceStatus,
  InterviewRound,
  InterviewRoundType,
  Job,
  PendingRelease,
  RosterRow,
  RoundOutcome,
} from './types';

export const jobsApi = {
  published: () => api.get<Job[]>('/jobs/published'),
  pendingApproval: () => api.get<Job[]>('/jobs/pending-approval'),
  mine: () => api.get<Job[]>('/jobs/mine'),
  targetColleges: () => api.get<{ id: string; name: string }[]>('/jobs/target-colleges'),

  create: (body: {
    collegeId: string;
    title: string;
    description: string;
    type: string;
    location?: string;
    packageLpa?: number;
    deadline: string;
    eligibility: {
      minCgpa?: number;
      maxBacklogs?: number;
      departmentIds: string[];
      batchYears: number[];
      requiredSkills: string[];
    };
  }) => api.post<Job>('/jobs', body),

  approve: (jobId: string) =>
    api.post<{ job: Job; eligibleCount: number }>(`/jobs/${jobId}/approve`),

  reject: (jobId: string, reason: string) => api.post<Job>(`/jobs/${jobId}/reject`, { reason }),
};

export const applicationsApi = {
  mine: () => api.get<Application[]>('/applications/mine'),
  forJob: (jobId: string) => api.get<ApplicantRow[]>(`/applications/jobs/${jobId}`),
  apply: (jobId: string) => api.post<Application>(`/applications/jobs/${jobId}/apply`),
  withdraw: (id: string) => api.post<Application>(`/applications/${id}/withdraw`),

  setStatus: (id: string, to: ApplicationStatus, note?: string) =>
    api.patch<Application>(`/applications/${id}/status`, { to, note }),

  recommend: (id: string, note: string) => api.post(`/applications/${id}/recommend`, { note }),

  roster: (jobId: string) => api.get<RosterRow[]>(`/applications/jobs/${jobId}/roster`),
};

export const interviewsApi = {
  rounds: (jobId: string) => api.get<InterviewRound[]>(`/interviews/jobs/${jobId}/rounds`),

  createRound: (
    jobId: string,
    body: {
      sequence: number;
      type: InterviewRoundType;
      scheduledAt: string;
      venue?: string;
      meetingLink?: string;
      interviewers: string[];
    },
  ) => api.post<InterviewRound>(`/interviews/jobs/${jobId}/rounds`, body),

  recordResult: (
    roundId: string,
    applicationId: string,
    body: {
      attendance: AttendanceStatus;
      rating?: number;
      feedback?: string;
      outcome: RoundOutcome;
    },
  ) => api.patch(`/interviews/rounds/${roundId}/results/${applicationId}`, body),

  publish: (roundId: string) =>
    api.post<{ advanced: number; rejected: number }>(`/interviews/rounds/${roundId}/publish`),

  awaitingRelease: () => api.get<PendingRelease[]>('/interviews/awaiting-release'),
  release: (roundId: string) => api.post(`/interviews/rounds/${roundId}/release`),
};
