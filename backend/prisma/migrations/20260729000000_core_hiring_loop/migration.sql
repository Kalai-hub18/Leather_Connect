-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'COLLEGE_ADMIN', 'PLACEMENT_OFFICER', 'STUDENT_COORDINATOR', 'HR', 'STUDENT', 'ALUMNI');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('INTERNSHIP', 'GRADUATE_TRAINEE', 'FULL_TIME', 'WALK_IN', 'OFF_CAMPUS', 'REFERRAL', 'CONTRACT', 'PART_TIME');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'PUBLISHED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('APPLIED', 'SCREENING', 'SHORTLISTED', 'WRITTEN_TEST', 'TECHNICAL_INTERVIEW', 'HR_INTERVIEW', 'SELECTED', 'REJECTED', 'WITHDRAWN', 'JOINED');

-- CreateEnum
CREATE TYPE "InterviewRoundType" AS ENUM ('WRITTEN_TEST', 'TECHNICAL', 'HR', 'MANAGERIAL');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDING', 'PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "RoundOutcome" AS ENUM ('PENDING', 'ADVANCED', 'REJECTED');

-- CreateTable
CREATE TABLE "College" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "College_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "collegeId" TEXT,
    "companyId" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollegeCompanyLink" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollegeCompanyLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "batchYear" INTEGER NOT NULL,
    "cgpa" DECIMAL(4,2) NOT NULL,
    "activeBacklogs" INTEGER NOT NULL DEFAULT 0,
    "skills" TEXT[],
    "resumeUrl" TEXT,
    "placementReady" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "postedByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "JobType" NOT NULL,
    "location" TEXT,
    "packageLpa" DECIMAL(6,2),
    "stipend" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'DRAFT',
    "deadline" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobEligibility" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "minCgpa" DECIMAL(4,2),
    "maxBacklogs" INTEGER,
    "departmentIds" TEXT[],
    "batchYears" INTEGER[],
    "requiredSkills" TEXT[],

    CONSTRAINT "JobEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "collegeId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'APPLIED',
    "cgpaSnapshot" DECIMAL(4,2) NOT NULL,
    "resumeUrlSnapshot" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationStatusHistory" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewRound" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "type" "InterviewRoundType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "venue" TEXT,
    "meetingLink" TEXT,
    "interviewers" TEXT[],
    "resultsPublishedAt" TIMESTAMP(3),
    "resultsReleasedAt" TIMESTAMP(3),
    "releasedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterviewRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewRoundResult" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "attendance" "AttendanceStatus" NOT NULL DEFAULT 'PENDING',
    "rating" INTEGER,
    "feedback" TEXT,
    "outcome" "RoundOutcome" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewRoundResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlumniRecommendation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "alumniUserId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlumniRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Department_collegeId_idx" ON "Department"("collegeId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_collegeId_idx" ON "User"("collegeId");

-- CreateIndex
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Company_status_idx" ON "Company"("status");

-- CreateIndex
CREATE INDEX "CollegeCompanyLink_status_idx" ON "CollegeCompanyLink"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CollegeCompanyLink_collegeId_companyId_key" ON "CollegeCompanyLink"("collegeId", "companyId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_userId_key" ON "StudentProfile"("userId");

-- CreateIndex
CREATE INDEX "StudentProfile_collegeId_placementReady_idx" ON "StudentProfile"("collegeId", "placementReady");

-- CreateIndex
CREATE INDEX "StudentProfile_departmentId_idx" ON "StudentProfile"("departmentId");

-- CreateIndex
CREATE INDEX "StudentProfile_batchYear_idx" ON "StudentProfile"("batchYear");

-- CreateIndex
CREATE INDEX "Job_collegeId_status_idx" ON "Job"("collegeId", "status");

-- CreateIndex
CREATE INDEX "Job_companyId_idx" ON "Job"("companyId");

-- CreateIndex
CREATE INDEX "Job_deadline_idx" ON "Job"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "JobEligibility_jobId_key" ON "JobEligibility"("jobId");

-- CreateIndex
CREATE INDEX "Application_collegeId_status_idx" ON "Application"("collegeId", "status");

-- CreateIndex
CREATE INDEX "Application_studentProfileId_idx" ON "Application"("studentProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_studentProfileId_key" ON "Application"("jobId", "studentProfileId");

-- CreateIndex
CREATE INDEX "ApplicationStatusHistory_applicationId_createdAt_idx" ON "ApplicationStatusHistory"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "InterviewRound_scheduledAt_idx" ON "InterviewRound"("scheduledAt");

-- CreateIndex
CREATE INDEX "InterviewRound_resultsPublishedAt_resultsReleasedAt_idx" ON "InterviewRound"("resultsPublishedAt", "resultsReleasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewRound_jobId_sequence_key" ON "InterviewRound"("jobId", "sequence");

-- CreateIndex
CREATE INDEX "InterviewRoundResult_applicationId_idx" ON "InterviewRoundResult"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewRoundResult_roundId_applicationId_key" ON "InterviewRoundResult"("roundId", "applicationId");

-- CreateIndex
CREATE INDEX "AlumniRecommendation_alumniUserId_idx" ON "AlumniRecommendation"("alumniUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AlumniRecommendation_applicationId_alumniUserId_key" ON "AlumniRecommendation"("applicationId", "alumniUserId");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollegeCompanyLink" ADD CONSTRAINT "CollegeCompanyLink_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CollegeCompanyLink" ADD CONSTRAINT "CollegeCompanyLink_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_collegeId_fkey" FOREIGN KEY ("collegeId") REFERENCES "College"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_postedByUserId_fkey" FOREIGN KEY ("postedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobEligibility" ADD CONSTRAINT "JobEligibility_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_studentProfileId_fkey" FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRound" ADD CONSTRAINT "InterviewRound_releasedByUserId_fkey" FOREIGN KEY ("releasedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRoundResult" ADD CONSTRAINT "InterviewRoundResult_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "InterviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRoundResult" ADD CONSTRAINT "InterviewRoundResult_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlumniRecommendation" ADD CONSTRAINT "AlumniRecommendation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlumniRecommendation" ADD CONSTRAINT "AlumniRecommendation_alumniUserId_fkey" FOREIGN KEY ("alumniUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

