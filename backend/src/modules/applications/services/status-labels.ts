import { ApplicationStatus } from '@prisma/client';

/** How each stage is worded to a student — plainer than the enum name. */
const LABELS: Record<ApplicationStatus, string> = {
  APPLIED: 'Applied',
  SCREENING: 'Under screening',
  SHORTLISTED: 'Shortlisted',
  WRITTEN_TEST: 'Written test',
  TECHNICAL_INTERVIEW: 'Technical interview',
  HR_INTERVIEW: 'HR interview',
  SELECTED: 'Selected',
  REJECTED: 'Not selected',
  WITHDRAWN: 'Withdrawn',
  JOINED: 'Joined',
};

export function humanizeStatus(status: ApplicationStatus): string {
  return LABELS[status];
}

/** The message a student sees when they reach each stage. */
export function statusMessage(status: ApplicationStatus, jobTitle: string, company: string): string {
  switch (status) {
    case ApplicationStatus.SHORTLISTED:
      return `You've been shortlisted for ${jobTitle} at ${company}.`;
    case ApplicationStatus.SELECTED:
      return `You've been selected for ${jobTitle} at ${company}.`;
    case ApplicationStatus.REJECTED:
      return `${company} isn't taking your ${jobTitle} application forward.`;
    case ApplicationStatus.JOINED:
      return `Your joining at ${company} is confirmed.`;
    default:
      return `Your ${jobTitle} application at ${company} moved to ${LABELS[status]}.`;
  }
}
