import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AppError } from '@/middleware/error-handler';
import { authRepository } from '../repositories/auth.repository';
import { LoginInput, RegisterInput } from '../schemas/auth.schemas';

const BCRYPT_COST = 12;
const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

function signAccessToken(payload: {
  sub: string;
  role: string;
  collegeId: string | null;
  companyId: string | null;
}) {
  return jwt.sign(payload, env.jwt.accessSecret, {
    expiresIn: env.jwt.accessTtl as jwt.SignOptions['expiresIn'],
  });
}

export const authService = {
  async register(input: RegisterInput) {
    const existing = await authRepository.findByEmail(input.email);
    if (existing) {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);
    const user = await authRepository.create({
      email: input.email,
      passwordHash,
      fullName: input.fullName,
      role: input.role,
      collegeId: input.collegeId,
    });

    // TODO(Phase 12 - Notifications module): send verification email.
    return { id: user.id, email: user.email, role: user.role };
  },

  async login(input: LoginInput) {
    const user = await authRepository.findByEmail(input.email);
    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError(423, 'ACCOUNT_LOCKED', 'Account temporarily locked. Try again later.');
    }

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) {
      const updated = await authRepository.incrementFailedLogin(user.id);
      if (updated.failedLoginCount >= MAX_FAILED_LOGINS) {
        await authRepository.lockAccount(
          user.id,
          new Date(Date.now() + LOCKOUT_MINUTES * 60_000),
        );
      }
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
    }

    await authRepository.resetFailedLogin(user.id);

    const accessToken = signAccessToken({
      sub: user.id,
      role: user.role,
      collegeId: user.collegeId,
      companyId: user.companyId,
    });

    // TODO(Phase 4 hardening): issue rotating refresh token in httpOnly cookie,
    // persisted hashed with a token_family_id per FR-1.4/FR-1.5.

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        collegeId: user.collegeId,
        companyId: user.companyId,
      },
    };
  },
};
