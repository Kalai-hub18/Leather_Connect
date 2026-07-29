import { PrismaClient, Role, VerificationStatus } from '@prisma/client';
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

  const company = await prisma.company.create({
    data: {
      name: 'Farida Leathers',
      industry: 'Footwear Manufacturing',
      website: 'https://faridagroup.com',
      status: VerificationStatus.APPROVED,
    },
  });

  await prisma.collegeCompanyLink.create({
    data: {
      collegeId: college.id,
      companyId: company.id,
      status: VerificationStatus.APPROVED,
      approvedAt: new Date(),
    },
  });

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
    { name: 'Priya Sharma', email: 'priya@annauniv.edu', roll: 'LT22001', cgpa: 8.4, backlogs: 0, ready: true, skills: ['Tanning', 'Quality Control', 'AutoCAD'] },
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
      },
    });

    students.push({ user, profile });
  }

  console.log('Seeded:');
  console.log(`  College      ${college.name} (${college.id})`);
  console.log(`  Department   ${department.name} (${department.id})`);
  console.log(`  Company      ${company.name} (${company.id})`);
  console.log(`  Officer      ${officer.email}`);
  console.log(`  Student cos  ${studentCoordinators.map((c) => c.email).join(', ')}`);
  console.log(`  HR           ${hr.email}`);
  console.log(`  Alumni       ${alumni.email}`);
  console.log(`  Students     ${students.length} (6 placement-ready, 1 pending)`);
  console.log(`\n  Password for every account: ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
