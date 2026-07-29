import { Role } from '@prisma/client';

export interface RequestContext {
  userId: string;
  role: Role;
  collegeId: string | null;
  companyId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      ctx?: RequestContext;
    }
  }
}
