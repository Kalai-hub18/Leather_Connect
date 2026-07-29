import { ApplicationStatus } from '@prisma/client';

/**
 * Allowed forward transitions (FR-7.2). Every status may also exit to
 * REJECTED; WITHDRAWN is reachable only from the two earliest states.
 * Keeping this map as the single source of truth means the Interview module
 * never mutates Application.status directly (§9.9).
 */
const FORWARD: Record<ApplicationStatus, ApplicationStatus[]> = {
  APPLIED: [ApplicationStatus.SCREENING],
  SCREENING: [ApplicationStatus.SHORTLISTED],
  SHORTLISTED: [ApplicationStatus.WRITTEN_TEST, ApplicationStatus.TECHNICAL_INTERVIEW],
  WRITTEN_TEST: [ApplicationStatus.TECHNICAL_INTERVIEW],
  TECHNICAL_INTERVIEW: [ApplicationStatus.HR_INTERVIEW],
  HR_INTERVIEW: [ApplicationStatus.SELECTED],
  SELECTED: [ApplicationStatus.JOINED],
  JOINED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

const TERMINAL: ApplicationStatus[] = [
  ApplicationStatus.JOINED,
  ApplicationStatus.REJECTED,
  ApplicationStatus.WITHDRAWN,
];

const WITHDRAWABLE: ApplicationStatus[] = [
  ApplicationStatus.APPLIED,
  ApplicationStatus.SCREENING,
];

export function isTerminal(status: ApplicationStatus): boolean {
  return TERMINAL.includes(status);
}

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  if (isTerminal(from)) return false;
  if (to === ApplicationStatus.REJECTED) return true;
  if (to === ApplicationStatus.WITHDRAWN) return WITHDRAWABLE.includes(from);
  return FORWARD[from].includes(to);
}

export function allowedNext(from: ApplicationStatus): ApplicationStatus[] {
  if (isTerminal(from)) return [];
  const next = [...FORWARD[from], ApplicationStatus.REJECTED];
  if (WITHDRAWABLE.includes(from)) next.push(ApplicationStatus.WITHDRAWN);
  return next;
}
