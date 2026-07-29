import { Prisma } from '@prisma/client';

export interface EligibilityRules {
  minCgpa: Prisma.Decimal | null;
  maxBacklogs: number | null;
  departmentIds: string[];
  batchYears: number[];
  requiredSkills: string[];
}

export interface StudentFacts {
  departmentId: string;
  batchYear: number;
  cgpa: Prisma.Decimal;
  activeBacklogs: number;
  skills: string[];
  placementReady: boolean;
}

export interface EligibilityResult {
  eligible: boolean;
  reasons: string[];
}

/**
 * Pure function — no I/O, no Prisma calls (§9.7). Evaluation on publish runs
 * as one batched query upstream, then maps students through this.
 */
export function evaluate(rules: EligibilityRules, student: StudentFacts): EligibilityResult {
  const reasons: string[] = [];

  if (!student.placementReady) {
    reasons.push('Profile is not approved by the coordinator yet');
  }

  if (rules.minCgpa !== null && student.cgpa.lessThan(rules.minCgpa)) {
    reasons.push(`Requires CGPA ${rules.minCgpa.toString()} or above`);
  }

  if (rules.maxBacklogs !== null && student.activeBacklogs > rules.maxBacklogs) {
    reasons.push(
      rules.maxBacklogs === 0
        ? 'Requires no active backlogs'
        : `Allows at most ${rules.maxBacklogs} active backlogs`,
    );
  }

  if (rules.departmentIds.length > 0 && !rules.departmentIds.includes(student.departmentId)) {
    reasons.push('Not open to your department');
  }

  if (rules.batchYears.length > 0 && !rules.batchYears.includes(student.batchYear)) {
    reasons.push(`Open to batch ${rules.batchYears.join(', ')} only`);
  }

  if (rules.requiredSkills.length > 0) {
    const have = new Set(student.skills.map((s) => s.toLowerCase()));
    const missing = rules.requiredSkills.filter((s) => !have.has(s.toLowerCase()));
    if (missing.length > 0) {
      reasons.push(`Missing required skills: ${missing.join(', ')}`);
    }
  }

  return { eligible: reasons.length === 0, reasons };
}
