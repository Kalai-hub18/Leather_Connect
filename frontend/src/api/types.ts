export type JobStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'PUBLISHED' | 'CLOSED' | 'CANCELLED';

export type JobType =
  | 'INTERNSHIP'
  | 'GRADUATE_TRAINEE'
  | 'FULL_TIME'
  | 'WALK_IN'
  | 'OFF_CAMPUS'
  | 'REFERRAL'
  | 'CONTRACT'
  | 'PART_TIME';

export type ApplicationStatus =
  | 'APPLIED'
  | 'SCREENING'
  | 'SHORTLISTED'
  | 'WRITTEN_TEST'
  | 'TECHNICAL_INTERVIEW'
  | 'HR_INTERVIEW'
  | 'SELECTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'JOINED';

export type InterviewRoundType = 'WRITTEN_TEST' | 'TECHNICAL' | 'HR' | 'MANAGERIAL';
export type AttendanceStatus = 'PENDING' | 'PRESENT' | 'ABSENT';
export type RoundOutcome = 'PENDING' | 'ADVANCED' | 'REJECTED';

export interface Company {
  id: string;
  name: string;
  industry: string | null;
  website: string | null;
}

export interface Eligibility {
  minCgpa: string | null;
  maxBacklogs: number | null;
  departmentIds: string[];
  batchYears: number[];
  requiredSkills: string[];
}

export interface Job {
  id: string;
  title: string;
  description: string;
  type: JobType;
  location: string | null;
  packageLpa: string | null;
  stipend: string | null;
  status: JobStatus;
  deadline: string;
  publishedAt: string | null;
  createdAt: string;
  company?: Company;
  college?: { id: string; name: string };
  eligibility?: Eligibility | null;
  _count?: { applications: number };
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: ApplicationStatus | null;
  toStatus: ApplicationStatus;
  note: string | null;
  createdAt: string;
}

export interface Recommendation {
  id: string;
  note: string;
  createdAt: string;
  alumni: { fullName: string };
}

export interface Application {
  id: string;
  status: ApplicationStatus;
  cgpaSnapshot: string;
  appliedAt: string;
  job: Job;
  history: StatusHistoryEntry[];
  /** An interview outcome exists but the placement officer hasn't released it. */
  resultPending?: boolean;
}

/** Applied vs not-applied roster — no marks, resumes or outcomes by design. */
export interface RosterRow {
  studentProfileId: string;
  fullName: string;
  rollNumber: string;
  batchYear: number;
  hasApplied: boolean;
}

export interface PendingRelease {
  id: string;
  sequence: number;
  type: InterviewRoundType;
  jobTitle: string;
  companyName: string;
  publishedAt: string;
  hoursWaiting: number;
  overdue: boolean;
  advanced: number;
  rejected: number;
}

export interface ApplicantRow {
  id: string;
  status: ApplicationStatus;
  cgpaSnapshot: string;
  appliedAt: string;
  student: {
    id: string;
    rollNumber: string;
    batchYear: number;
    activeBacklogs: number;
    skills: string[];
    user: { fullName: string; email: string };
  };
  recommendations: Recommendation[];
}

export interface RoundResult {
  id: string;
  applicationId: string;
  attendance: AttendanceStatus;
  rating: number | null;
  feedback: string | null;
  outcome: RoundOutcome;
  application: {
    id: string;
    status: ApplicationStatus;
    student: { user: { fullName: string } };
  };
}

export interface InterviewRound {
  id: string;
  sequence: number;
  type: InterviewRoundType;
  scheduledAt: string;
  venue: string | null;
  meetingLink: string | null;
  interviewers: string[];
  resultsPublishedAt: string | null;
  resultsReleasedAt: string | null;
  results: RoundResult[];
}

export interface PendingRecruiter {
  linkId: string;
  requestedAt: string;
  company: {
    id: string;
    name: string;
    industry: string | null;
    website: string | null;
    location: string | null;
    description: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    priorDrives: number;
  };
  recruiters: { id: string; fullName: string; email: string; createdAt: string }[];
}

export interface StudentProfile {
  id: string;
  rollNumber: string;
  batchYear: number;
  cgpa: string;
  activeBacklogs: number;
  skills: string[];
  phone: string | null;
  about: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  portfolioUrl: string | null;
  resumeUrl: string | null;
  resumeFileName: string | null;
  placementReady: boolean;
  submittedForReviewAt: string | null;
  reviewNote: string | null;
  user: { fullName: string; email: string };
  department: { name: string };
  completeness: { percent: number; missing: string[] };
}

export interface PendingProfile {
  id: string;
  rollNumber: string;
  batchYear: number;
  cgpa: string;
  activeBacklogs: number;
  skills: string[];
  about: string | null;
  resumeUrl: string | null;
  submittedForReviewAt: string | null;
  user: { fullName: string; email: string };
  department: { name: string };
}

export interface UpcomingRound {
  jobTitle: string;
  company?: string;
  sequence: number;
  type: InterviewRoundType;
  scheduledAt: string;
  where: string | null;
  candidates?: number;
}

export interface CollegeOverview {
  headline: {
    studentsTotal: number;
    placementReady: number;
    placed: number;
    placedPercent: number;
    activeDrives: number;
    applications: number;
  };
  packages: { highest: number | null; average: number | null; offersWithPackage: number };
  offerAcceptance: number | null;
  funnel: { stage: ApplicationStatus; count: number }[];
  topCompanies: { name: string; offers: number }[];
  actionable: {
    jobsAwaitingApproval: number;
    resultsAwaitingRelease: number;
    profilesAwaitingReview: number;
    recruitersAwaitingApproval: number;
  };
}

export interface StudentOverview {
  placementReady: boolean;
  hasResume: boolean;
  skillCount: number;
  openDrives: number;
  applications: { total: number; active: number; interviewing: number; offers: number };
  upcoming: UpcomingRound[];
}

export interface RecruiterOverview {
  jobs: { total: number; published: number; pendingApproval: number };
  applications: { total: number; needsAction: number; shortlisted: number; selected: number };
  upcoming: UpcomingRound[];
}

export type NotificationType =
  | 'JOB_PUBLISHED'
  | 'APPLICATION_RECEIVED'
  | 'STATUS_CHANGED'
  | 'INTERVIEW_SCHEDULED'
  | 'RESULT_RELEASED'
  | 'JOB_PENDING_APPROVAL'
  | 'ENDORSEMENT_RECEIVED'
  | 'PROFILE_APPROVED';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Turns SCREAMING_SNAKE enums into display text. */
export function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
