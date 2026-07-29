import { Role } from '@prisma/client';
import { RequestContext } from '@/types/request-context';

/**
 * Injects college_id scoping into a Prisma `where` clause unless the caller
 * is Super Admin. Every repository method touching a tenant-scoped table
 * must route its where-clause through this guard — a missing call here is
 * the one way cross-tenant data could leak.
 */
export function withTenantScope<T extends Record<string, unknown>>(
  where: T,
  ctx: RequestContext,
): T & { collegeId?: string } {
  if (ctx.role === Role.SUPER_ADMIN) {
    return where;
  }
  if (!ctx.collegeId) {
    throw new Error('Tenant-scoped request context missing collegeId');
  }
  return { ...where, collegeId: ctx.collegeId };
}
