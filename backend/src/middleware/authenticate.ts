import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AppError } from './error-handler';
import { RequestContext } from '@/types/request-context';

interface AccessTokenPayload {
  sub: string;
  role: RequestContext['role'];
  collegeId: string | null;
  companyId: string | null;
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(new AppError(401, 'UNAUTHENTICATED', 'Missing access token'));
  }

  const token = header.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
    req.ctx = {
      userId: payload.sub,
      role: payload.role,
      collegeId: payload.collegeId,
      companyId: payload.companyId,
    };
    next();
  } catch {
    next(new AppError(401, 'UNAUTHENTICATED', 'Invalid or expired access token'));
  }
}
