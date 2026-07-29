import { NextFunction, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { AppError } from './error-handler';

export function authorize(...allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.ctx) {
      return next(new AppError(401, 'UNAUTHENTICATED', 'Missing request context'));
    }
    if (!allowedRoles.includes(req.ctx.role)) {
      return next(new AppError(403, 'FORBIDDEN', 'Insufficient role for this action'));
    }
    next();
  };
}
