import { prisma } from '@/config/prisma';
import { Role } from '@prisma/client';

export const authRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } });
  },

  create(data: {
    email: string;
    passwordHash: string;
    fullName: string;
    role: Role;
    collegeId?: string;
  }) {
    return prisma.user.create({ data });
  },

  incrementFailedLogin(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: { increment: 1 } },
    });
  },

  resetFailedLogin(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null },
    });
  },

  lockAccount(userId: string, until: Date) {
    return prisma.user.update({ where: { id: userId }, data: { lockedUntil: until } });
  },
};
