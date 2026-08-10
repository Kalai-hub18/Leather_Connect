import {
  ApplicationStatus,
  InterviewRoundType,
  JobStatus,
  JobType,
  PrismaClient,
  Role,
  VerificationStatus,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const PASSWORD = 'Passw0rd!';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);

  const college = await prisma.college.create({
    data: { name: 'Anna University — Dept. of Leather Technology', domain: 'annauniv.edu' },
  });

  const department = await prisma.department.create({
    data: { collegeId: college.id, name: 'Leather Technology' },
  });

  const companySeed = [
    {
      name: 'Farida Leathers',
      industry: 'Footwear Manufacturing',
      website: 'https://faridagroup.com',
      location: 'Ambur, Tamil Nadu',
      description: 'One of India\'s largest shoe exporters, operating tanneries across Ambur and Vaniyambadi.',
    },
    {
      name: 'CLE Footwear Co.',
      industry: 'Footwear & Components',
      website: 'https://clefootwear.example',
      location: 'Chennai, Tamil Nadu',
      description: 'Export-focused footwear manufacturer with an in-house finishing unit.',
    },
    {
      name: 'Hidesign Group',
      industry: 'Leather Goods',
      website: 'https://hidesign.example',
      location: 'Puducherry',
      description: 'Vegetable-tanned leather bags and accessories, sold across 20 countries.',
    },
    {
      name: 'Bata India',
      industry: 'Retail Footwear',
      website: 'https://bata.example',
      location: 'Gurugram, Haryana',
      description: 'Retail footwear major running a structured graduate intake every year.',
    },
  ];

  const companies = [];
  for (const c of companySeed) {
    const created = await prisma.company.create({
      data: { ...c, status: VerificationStatus.APPROVED },
    });

    await prisma.collegeCompanyLink.create({
      data: {
        collegeId: college.id,
        companyId: created.id,
        status: VerificationStatus.APPROVED,
        approvedAt: new Date(),
      },
    });

    companies.push(created);
  }

  const [company, cle, hidesign, bata] = companies;

  const officer = await prisma.user.create({
    data: {
      email: 'officer@annauniv.edu',
      passwordHash,
      fullName: 'Dr. Deepa Krishnan',
      role: Role.PLACEMENT_OFFICER,
      collegeId: college.id,
      emailVerifiedAt: new Date(),
    },
  });

  const studentCoordinators = await Promise.all(
    [
      { email: 'coord1@annauniv.edu', fullName: 'Nithya Balan' },
      { email: 'coord2@annauniv.edu', fullName: 'Suresh Kumar' },
    ].map((c) =>
      prisma.user.create({
        data: {
          ...c,
          passwordHash,
          role: Role.STUDENT_COORDINATOR,
          collegeId: college.id,
          emailVerifiedAt: new Date(),
        },
      }),
    ),
  );

  const hr = await prisma.user.create({
    data: {
      email: 'hr@faridagroup.com',
      passwordHash,
      fullName: 'Ravi Subramanian',
      role: Role.HR,
      companyId: company.id,
      emailVerifiedAt: new Date(),
    },
  });

  // Each company needs a poster of record, since Job.postedByUserId is required.
  const otherRecruiters = await Promise.all(
    [
      { email: 'hiring@clefootwear.example', fullName: 'Lakshmi Venkat', companyId: cle.id },
      { email: 'careers@hidesign.example', fullName: 'Joseph Mathew', companyId: hidesign.id },
      { email: 'campus@bata.example', fullName: 'Neha Kapoor', companyId: bata.id },
    ].map((r) =>
      prisma.user.create({
        data: { ...r, passwordHash, role: Role.HR, emailVerifiedAt: new Date() },
      }),
    ),
  );

  const [cleHr, hidesignHr, bataHr] = otherRecruiters;

  const alumni = await prisma.user.create({
    data: {
      email: 'vikram@bata.com',
      passwordHash,
      fullName: 'Vikram Nair',
      role: Role.ALUMNI,
      collegeId: college.id,
      emailVerifiedAt: new Date(),
    },
  });

  const studentSeed = [
    {
      name: 'Priya Sharma',
      email: 'priya@annauniv.edu',
      roll: 'LT22001',
      cgpa: 8.4,
      backlogs: 0,
      ready: true,
      skills: ['Tanning', 'Quality Control', 'AutoCAD', 'Six Sigma'],
      phone: '+91 98407 21134',
      about:
        'Final-year Leather Technology student. Spent two semesters on the college tannery line and ran a yield-improvement project on the wet-blue stage. Comfortable with process documentation and QC sampling plans.',
      linkedinUrl: 'https://linkedin.com/in/priyasharma',
      resumeUrl: 'https://example.com/priya-sharma-resume.pdf',
    },
    { name: 'Arjun Iyer', email: 'arjun@annauniv.edu', roll: 'LT22002', cgpa: 7.9, backlogs: 0, ready: true, skills: ['Tanning', 'Leather Finishing'] },
    { name: 'Meera Nair', email: 'meera@annauniv.edu', roll: 'LT22003', cgpa: 8.1, backlogs: 1, ready: true, skills: ['Quality Control', 'Footwear Design'] },
    { name: 'Karthik Raj', email: 'karthik@annauniv.edu', roll: 'LT22004', cgpa: 7.6, backlogs: 0, ready: true, skills: ['Tanning'] },
    { name: 'Sneha Pillai', email: 'sneha@annauniv.edu', roll: 'LT22005', cgpa: 9.0, backlogs: 0, ready: true, skills: ['Tanning', 'Quality Control', 'Six Sigma'] },
    { name: 'Rahul Desai', email: 'rahul@annauniv.edu', roll: 'LT22006', cgpa: 6.2, backlogs: 2, ready: true, skills: ['Leather Finishing'] },
    { name: 'Divya Menon', email: 'divya@annauniv.edu', roll: 'LT22007', cgpa: 8.7, backlogs: 0, ready: false, skills: ['Footwear Design'] },
  ];

  const students = [];
  for (const s of studentSeed) {
    const user = await prisma.user.create({
      data: {
        email: s.email,
        passwordHash,
        fullName: s.name,
        role: Role.STUDENT,
        collegeId: college.id,
        emailVerifiedAt: new Date(),
      },
    });

    const profile = await prisma.studentProfile.create({
      data: {
        userId: user.id,
        collegeId: college.id,
        departmentId: department.id,
        rollNumber: s.roll,
        batchYear: 2026,
        cgpa: s.cgpa,
        activeBacklogs: s.backlogs,
        skills: s.skills,
        placementReady: s.ready,
        phone: 'phone' in s ? s.phone : null,
        about: 'about' in s ? s.about : null,
        linkedinUrl: 'linkedinUrl' in s ? s.linkedinUrl : null,
        resumeUrl: 'resumeUrl' in s ? s.resumeUrl : null,
      },
    });

    students.push({ user, profile });
  }

  const byRoll = new Map(students.map((s) => [s.profile.rollNumber, s]));
  const priya = byRoll.get('LT22001')!;
  const arjun = byRoll.get('LT22002')!;
  const sneha = byRoll.get('LT22005')!;
  const karthik = byRoll.get('LT22004')!;

  const days = (n: number) => new Date(Date.now() + n * 86_400_000);

  const jobSeed = [
    {
      company,
      postedBy: hr.id,
      title: 'Graduate Trainee — Tanning Operations',
      description:
        'Two-year rotational programme across wet-blue processing, finishing and quality control. Posted to a shop-floor role in Ambur after the rotation.',
      type: JobType.GRADUATE_TRAINEE,
      location: 'Ambur, Tamil Nadu',
      packageLpa: 5.4,
      deadline: days(21),
      status: JobStatus.PUBLISHED,
      eligibility: { minCgpa: 7.0, maxBacklogs: 0, batchYears: [2026], requiredSkills: ['Tanning'] },
    },
    {
      company: cle,
      postedBy: cleHr.id,
      title: 'Quality Analyst',
      description:
        'Own incoming-hide inspection and finished-goods QC for the export line. Works closely with the tannery floor and the buyer QA team.',
      type: JobType.FULL_TIME,
      location: 'Chennai, Tamil Nadu',
      packageLpa: 4.8,
      deadline: days(12),
      status: JobStatus.PUBLISHED,
      eligibility: { minCgpa: 6.5, maxBacklogs: 1, batchYears: [2026], requiredSkills: ['Quality Control'] },
    },
    {
      company: hidesign,
      postedBy: hidesignHr.id,
      title: 'Process Engineer — Vegetable Tanning',
      description:
        'Improve yield and consistency across the vegetable tanning line. Suits someone strong on tanning chemistry who likes measurable process work.',
      type: JobType.FULL_TIME,
      location: 'Puducherry',
      packageLpa: 6.1,
      deadline: days(30),
      status: JobStatus.PUBLISHED,
      eligibility: { minCgpa: 7.5, maxBacklogs: 0, batchYears: [2026], requiredSkills: ['Tanning'] },
    },
    {
      company: bata,
      postedBy: bataHr.id,
      title: 'Design Intern — Footwear',
      description:
        'Six-month paid internship with the product design team. Portfolio matters more than marks here.',
      type: JobType.INTERNSHIP,
      location: 'Gurugram, Haryana',
      stipend: '₹18,000/month',
      deadline: days(6),
      status: JobStatus.PUBLISHED,
      eligibility: { minCgpa: 6.0, maxBacklogs: 2, batchYears: [2026], requiredSkills: [] },
    },
    {
      company: bata,
      postedBy: bataHr.id,
      title: 'Retail Management Trainee',
      description: 'Store operations and merchandising track across North India.',
      type: JobType.GRADUATE_TRAINEE,
      location: 'Multiple locations',
      packageLpa: 4.2,
      deadline: days(18),
      // Left pending so the officer's approval queue isn't empty on first login.
      status: JobStatus.PENDING_APPROVAL,
      eligibility: { minCgpa: 6.0, maxBacklogs: 1, batchYears: [2026], requiredSkills: [] },
    },
  ];

  const jobs = [];
  for (const j of jobSeed) {
    const created = await prisma.job.create({
      data: {
        collegeId: college.id,
        companyId: j.company.id,
        postedByUserId: j.postedBy,
        approvedByUserId: j.status === JobStatus.PUBLISHED ? officer.id : null,
        publishedAt: j.status === JobStatus.PUBLISHED ? new Date() : null,
        title: j.title,
        description: j.description,
        type: j.type,
        location: j.location,
        packageLpa: j.packageLpa,
        stipend: j.stipend,
        deadline: j.deadline,
        status: j.status,
        eligibility: {
          create: {
            minCgpa: j.eligibility.minCgpa,
            maxBacklogs: j.eligibility.maxBacklogs,
            departmentIds: [],
            batchYears: j.eligibility.batchYears,
            requiredSkills: j.eligibility.requiredSkills,
          },
        },
      },
    });
    jobs.push(created);
  }

  const [tanningJob, qaJob, processJob, internJob] = jobs;

  /** Writes an application and replays its ledger, so history reads believably. */
  async function seedApplication(
    job: (typeof jobs)[number],
    student: (typeof students)[number],
    path: { status: ApplicationStatus; note?: string; daysAgo: number }[],
  ) {
    const application = await prisma.application.create({
      data: {
        jobId: job.id,
        studentProfileId: student.profile.id,
        collegeId: college.id,
        status: path[path.length - 1].status,
        cgpaSnapshot: student.profile.cgpa,
        appliedAt: days(-path[0].daysAgo),
      },
    });

    let previous: ApplicationStatus | null = null;
    for (const step of path) {
      await prisma.applicationStatusHistory.create({
        data: {
          applicationId: application.id,
          fromStatus: previous,
          toStatus: step.status,
          actorUserId: previous === null ? student.user.id : hr.id,
          note: step.note,
          createdAt: days(-step.daysAgo),
        },
      });
      previous = step.status;
    }

    return application;
  }

  // Priya: one far along, one mid-flight, one just submitted, one closed out.
  const priyaTanning = await seedApplication(tanningJob, priya, [
    { status: ApplicationStatus.APPLIED, daysAgo: 18 },
    { status: ApplicationStatus.SCREENING, daysAgo: 15 },
    { status: ApplicationStatus.SHORTLISTED, note: 'Strong fit on tanning chemistry', daysAgo: 12 },
    { status: ApplicationStatus.TECHNICAL_INTERVIEW, note: 'Round 1 (TECHNICAL) result', daysAgo: 5 },
  ]);

  await seedApplication(qaJob, priya, [
    { status: ApplicationStatus.APPLIED, daysAgo: 9 },
    { status: ApplicationStatus.SCREENING, daysAgo: 6 },
  ]);

  await seedApplication(processJob, priya, [{ status: ApplicationStatus.APPLIED, daysAgo: 2 }]);

  await seedApplication(internJob, priya, [
    { status: ApplicationStatus.APPLIED, daysAgo: 24 },
    { status: ApplicationStatus.SCREENING, daysAgo: 21 },
    { status: ApplicationStatus.REJECTED, note: 'Portfolio not a fit for this cycle', daysAgo: 19 },
  ]);

  // Other candidates, so recruiter and officer views aren't single-row either.
  await seedApplication(tanningJob, arjun, [
    { status: ApplicationStatus.APPLIED, daysAgo: 17 },
    { status: ApplicationStatus.SCREENING, daysAgo: 14 },
    { status: ApplicationStatus.SHORTLISTED, daysAgo: 12 },
    { status: ApplicationStatus.TECHNICAL_INTERVIEW, note: 'Round 1 (TECHNICAL) result', daysAgo: 5 },
  ]);

  await seedApplication(tanningJob, sneha, [
    { status: ApplicationStatus.APPLIED, daysAgo: 16 },
    { status: ApplicationStatus.SCREENING, daysAgo: 14 },
    { status: ApplicationStatus.SHORTLISTED, daysAgo: 12 },
    { status: ApplicationStatus.TECHNICAL_INTERVIEW, daysAgo: 5 },
    { status: ApplicationStatus.HR_INTERVIEW, note: 'Round 2 (HR) result', daysAgo: 2 },
    { status: ApplicationStatus.SELECTED, note: 'Offer extended', daysAgo: 1 },
  ]);

  await seedApplication(tanningJob, karthik, [
    { status: ApplicationStatus.APPLIED, daysAgo: 15 },
    { status: ApplicationStatus.SCREENING, daysAgo: 13 },
    { status: ApplicationStatus.REJECTED, note: 'Did not clear screening', daysAgo: 11 },
  ]);

  await seedApplication(qaJob, arjun, [{ status: ApplicationStatus.APPLIED, daysAgo: 8 }]);

  // A scheduled round so "Coming up" has something in it.
  const round = await prisma.interviewRound.create({
    data: {
      jobId: tanningJob.id,
      sequence: 2,
      type: InterviewRoundType.HR,
      scheduledAt: days(4),
      venue: 'Farida Leathers, Ambur',
      interviewers: ['R. Subramanian', 'HR Panel'],
    },
  });

  await prisma.interviewRoundResult.createMany({
    data: [
      { roundId: round.id, applicationId: priyaTanning.id },
    ],
  });

  // An alumnus has vouched for Priya, so the endorsement column isn't blank.
  await prisma.alumniRecommendation.create({
    data: {
      applicationId: priyaTanning.id,
      alumniUserId: alumni.id,
      note: 'Worked with Priya on the college tannery project — reliable on process control and unusually good at documentation.',
    },
  });

  console.log('Seeded:');
  console.log(`  College      ${college.name}`);
  console.log(`  Companies    ${companies.map((c) => c.name).join(', ')}`);
  console.log(`  Officer      ${officer.email}`);
  console.log(`  Student cos  ${studentCoordinators.map((c) => c.email).join(', ')}`);
  console.log(`  HR           ${hr.email}`);
  console.log(`  Alumni       ${alumni.email}`);
  console.log(`  Students     ${students.length} (6 placement-ready, 1 pending)`);
  console.log(`  Jobs         ${jobs.length} (4 published, 1 awaiting approval)`);
  console.log(`  Applications 8 across 4 drives, with replayed history`);
  console.log(`\n  Password for every account: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
