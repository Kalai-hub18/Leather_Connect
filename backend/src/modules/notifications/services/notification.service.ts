import { NotificationType, Prisma } from '@prisma/client';
import { prisma } from '@/config/prisma';
import { logger } from '@/config/logger';
import { RequestContext } from '@/types/request-context';

export interface NotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
}

export const notificationService = {
  /**
   * Writes the in-app row — the one channel that must always succeed (§9.10).
   * Email and push get layered on here later as best-effort side effects.
   *
   * Never let a notification failure roll back the action that triggered it:
   * a student being shortlisted matters more than them hearing about it.
   */
  async dispatch(input: NotificationInput | NotificationInput[]) {
    const rows = Array.isArray(input) ? input : [input];
    if (rows.length === 0) return;

    try {
      await prisma.notification.createMany({
        data: rows.map((r) => ({
          userId: r.userId,
          type: r.type,
          title: r.title,
          body: r.body,
          link: r.link,
        })),
      });
    } catch (err) {
      logger.error({ err, count: rows.length }, 'Failed to write notifications');
    }
  },

  async list(ctx: RequestContext, opts: { unreadOnly?: boolean; limit?: number } = {}) {
    const where: Prisma.NotificationWhereInput = { userId: ctx.userId };
    if (opts.unreadOnly) where.readAt = null;

    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: opts.limit ?? 30,
    });
  },

  async unreadCount(ctx: RequestContext) {
    return prisma.notification.count({ where: { userId: ctx.userId, readAt: null } });
  },

  async markRead(id: string, ctx: RequestContext) {
    // Scoped by userId so one user can't mark another's notification read.
    const result = await prisma.notification.updateMany({
      where: { id, userId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  },

  async markAllRead(ctx: RequestContext) {
    const result = await prisma.notification.updateMany({
      where: { userId: ctx.userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  },
};
