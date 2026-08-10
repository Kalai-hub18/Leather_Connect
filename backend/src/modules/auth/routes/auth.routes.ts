import { Router } from 'express';
import { rateLimit } from '@/middleware/rate-limit';
import { authController } from '../controllers/auth.controller';

export const authRoutes = Router();

// FR-1.6 locks a single account after repeated failures; this stops one IP
// working through many accounts, which per-account lockout can't see.
authRoutes.post(
  '/login',
  rateLimit({ windowMs: 15 * 60_000, max: 20, key: 'login' }),
  authController.login,
);

authRoutes.post(
  '/register',
  rateLimit({ windowMs: 60 * 60_000, max: 5, key: 'register' }),
  authController.register,
);
